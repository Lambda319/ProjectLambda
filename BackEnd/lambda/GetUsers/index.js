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

    let params = {
        tokens: tokens,
        email: null
    };
    if (request.headers.email) {
        params.email = request.headers.email;
    }
    return params;
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
//RDS Functions
async function queryRDS(request) {
    const params = {
        FunctionName: "RDSAdapter",
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(request)
    };

    log("RDS Request", "After params", `params: ${params}`);

    try {
        let rdsResponse = await lambda.invoke(params).promise();
        let response = JSON.parse(rdsResponse.Payload);
        log("queryRDS", "After RDS", `response: ${JSON.stringify(response)}`);
        return response;
    } catch (err) {
        return buildResponse(1, 500,
            warn("queryRDS", "err response", `error retrieving users: ${JSON.stringify(err.stack)}`));
    }
}

function formatInputForGetUsersRDS(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "GET_USERS",
        body: {}
    };
}

function formatInputForGetUserStatusRDS(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "GET_USER_STATUS",
        body: {
            email: request.email
        }
    };
}

//==================================================================================================


exports.handler = async (event, context) => {
    try {
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

        let params = parseInput(event);
        let request;
        if (params.email) {
            if (typeof params.email !== "string") {
                return buildResponse(4, 400,
                    warn("main", "params.email", `email should be a string, query: ${JSON.stringify(event)}`));
            }
            request = formatInputForGetUserStatusRDS(params);
        } else {
            request = formatInputForGetUsersRDS(params);
        }

        log("main", "getUser(s) Request", `Request: ${JSON.stringify(request)}`);

        let response = await queryRDS(request);
        if (response.error !== 0) {
            return response;
        }

        log("main", "getUser(s) Response", `Response: ${JSON.stringify(response)}`);

        //response.msg = JSON.parse(response.msg);

        return buildResponse(0, 200,
            log("main", "Response Msg", `Retrieved Users: ${JSON.stringify(response)}`),
            response.body,
            {
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            });

    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "response", `Error in Get Users  $${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ GetUsers - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}
