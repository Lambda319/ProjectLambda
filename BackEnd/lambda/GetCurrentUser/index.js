const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
AWS.config.region = "us-west-2";

let useremail = "unknown";
let requestID = "no request ID";

function parseInput(request) {
    let tokens = {
        updated: false,
        access_token: request.headers.access_token,
        refresh_token: request.headers.refresh_token
    };

    return {
        tokens: tokens
    };
}

function buildResponse(errorCode, statusCode, msg, body = {}, headers = {}) {
    return {
        headers: headers,
        error: errorCode,
        msg: msg,
        statusCode: statusCode,
        body: body
    };
}

//==================================================================================================
//Zoom Adapter Functions
async function callZoomAdapter(request) {
    const params = {
        FunctionName: "ZoomAdapter",
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(request),
    };

    log("callZoomAdapter", "After params", `params: ${JSON.stringify(params)}`);

    try {
        let response = await lambda.invoke(params).promise();
        log("callZoomAdapter", "After response", `response: ${JSON.stringify(response.Payload)}`);
        return JSON.parse(response.Payload);
    } catch (err) {
        return buildResponse(1, 500,
            warn("callZoomAdapter", "err response", `error querying ZoomAdapter: ${JSON.stringify(err.stack)}`));
    }
}

function formatInputForZoomAdapter(request) {
    return {
        name: "ME",
        body: {
            token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
        }
    };
}

//==================================================================================================

//==================================================================================================
//RDS Adapter Functions

function formatInputForRDSGetUser(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "GET_USER",
        body: {
            email: request.email
        }
    };
}

function formatInputForRDSUpdateUserName(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "UPDATE_USER_NAME",
        body: {
            email: request.email,
            first_name: request.first_name,
            last_name: request.last_name
        }
    };
}

async function queryRDS(request) {
    const params = {
        FunctionName: "RDSAdapter",
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(request)
    };

    log("RDS Request", "After params", `params: ${JSON.stringify(params)}`);

    try {
        let rdsResponse = await lambda.invoke(params).promise();
        let response = JSON.parse(rdsResponse.Payload);
        log("queryRDS", "After RDS", `response: ${JSON.stringify(response)}`);
        return response;
    } catch (err) {
        return buildResponse(1, 500,
            warn("queryRDS", "err response", `error updating user name: ${JSON.stringify(err.stack)}`));
    }
}

//==================================================================================================

exports.handler = async (event, context) => {
    try {
        log("main", "received event", `got event ${JSON.stringify(event)}`);

        requestID = context.awsRequestId;
        useremail = event.headers.user || "unknown";

        log("main", "received event", `got event ${JSON.stringify(event)}`);

        if (!event.headers) {
            return buildResponse(2, 400,
                warn("main", "event.headers", `Missing headers, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.access_token || !event.headers.refresh_token) {
            return buildResponse(2, 401,
                warn("main", "event.headers.tokens", `Missing tokens, access denied, query: ${JSON.stringify(event)}`));
        }

        log("main", "after", `got event ${JSON.stringify(event)}`);

        let params = parseInput(event);
        let zoomRequest = formatInputForZoomAdapter(params);

        log("main", "Zoom Adapter Request", `Zoom Request: ${JSON.stringify(zoomRequest)}`);

        let zoomResponse = await callZoomAdapter(zoomRequest);
        if (!zoomResponse) {
            return buildResponse(1, 500,
                warn("main", "Zoom Adapter Response", "Error querying Zoom API - check logs. Zoom Adapter response was null"));
        }

        if (zoomResponse.error === 1) {
            return buildResponse(1, 500,
                warn("main", "Zoom Adapter Response", `Error in Zoom Adapter ${JSON.stringify(zoomResponse)}
                for query ${JSON.stringify(params.request)}`));
        }

        if (zoomResponse.error === 2) {
            return buildResponse(2, 401,
                warn("main", "Zoom Adapter Response", `Error authenticating with zoom. Refresh needed, 
                access unauthorized ${JSON.stringify(zoomResponse)}`));
        }

        if (zoomResponse.error === 3) {
            return buildResponse(3, 500,
                warn("main", "Zoom Adapter Response", `Internal Error querying Zoom Adapter - Invalid API name, 
                ZA: ${JSON.stringify(zoomResponse)}, query: ${JSON.stringify(params.request)}`));
        }

        if (zoomResponse.error === 4) {
            return buildResponse(4, 400,
                warn("main", "Zoom Adapter Response", `Internal Error querying Zoom Adapter - Malformed request, 
                ZA: ${JSON.stringify(zoomResponse)}, query: ${JSON.stringify(params.request)}`));
        }

        log("main", "Zoom Adapter Response", `Zoom Response: ${JSON.stringify(zoomResponse)}`);

        if (zoomResponse.token.updated) {
            params.tokens.access_token = zoomResponse.token.access;
            params.tokens.refresh_token = zoomResponse.token.refresh;
        }

        let zoomBodyResponse = JSON.parse(zoomResponse.body);

        params.first_name = zoomBodyResponse.first_name;
        params.last_name = zoomBodyResponse.last_name;
        params.email = zoomBodyResponse.email;

        let getUserQuery = formatInputForRDSGetUser(params);
        log("main", "getUserQuery", `Request: ${JSON.stringify(getUserQuery)}`);
        let getUserResponse = await queryRDS(getUserQuery);
        if (getUserResponse.error !== 0) {
            if (getUserResponse.statusCode === 404) {
                return buildResponse(2, 401,
                    warn("main", "GetUserRDS", `No user in RDS with matching email ${params.email}. Access denied`));
            }
            return getUserResponse;
        }

        log("main", "getUserResponse", `Response: ${JSON.stringify(getUserResponse)}`);

        let user = {
            fname: getUserResponse.body.FName,
            lname: getUserResponse.body.LName
        };

        log("main", "After RDS Username", `User name: ${JSON.stringify(user)}`);

        let responseMessage = "User email and name retrieved";

        if (user.fname !== params.first_name || user.lname !== params.last_name) {
            log("main", "Username update", `Updating name in RDS for user ${params.email}
                from ${user.fname} ${user.lname} to ${params.first_name} ${params.last_name}`);

            let updateUserQuery = formatInputForRDSUpdateUserName(params);
            log("main", "updateUserQuery", `Request: ${JSON.stringify(updateUserQuery)}`);
            let updateUserResponse = await queryRDS(updateUserQuery);
            responseMessage += `, updated to ${zoomBodyResponse.first_name} ${zoomBodyResponse.last_name} in RDS`;

            if (updateUserResponse.error !== 0) {
                responseMessage = `User authenticated, but error updating name in RDS, err: ${JSON.stringify(updateUserResponse)}`;
            }
        }

        return buildResponse(0, 200,
            log("main", "response", responseMessage),
            {
                email: zoomBodyResponse.email,
                name: `${zoomBodyResponse.first_name} ${zoomBodyResponse.last_name}`
            },
            {
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            }
        );
    } catch (err) {
        return buildResponse(
            1, 500,
            warn("main", "err", "Error in Get Current user " + JSON.stringify(err.stack) || "unknown error"));
    }
};

function warn(funcname, process, log) {
    const logline = getLogLine(funcname, process, log);
    console.warn(logline);
    return logline;
}

function log(funcname, process, log) {
    const logline = getLogLine(funcname, process, log);
    console.log(logline);
    return logline;
}

function getLogLine(funcname, process, log) {
    return `[[ GetCurrentUser - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}