const AWS = require("aws-sdk");
AWS.config.region = "us-west-2";
const lambda = new AWS.Lambda();

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
        email: request.headers.email,
    };

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
function parseRDSResponse(response, email) {
    let userGroups = {
        email: email,
        groups: []
    };

    log("Parse Response", "Before parsing", `group response: ${JSON.stringify(response)}`);

    for (let group of response) {
        userGroups.groups.push(JSON.parse(group.Group));
    }
    return userGroups;
}


function formatInputForRDS(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "GET_USER_GROUPS",
        body: {
            email: request.email,
        }
    };
}


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
            warn("queryRDS", "err response", `error retrieving groups: ${JSON.stringify(err.stack)}`));
    }
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

        if (!event.headers.email) {
            return buildResponse(4, 400,
                warn("main", "event.body", `"Missing required email object, query: ${JSON.stringify(event)}`));
        } else if (typeof event.headers.email !== "string") {
            return buildResponse(4, 400,
                warn("main", "event.headers.email", `email should be a string, query: ${JSON.stringify(event)}`));
        }

        let params = parseInput(event);
        let getUserGroupsRequests = formatInputForRDS(params);
        log("main", "getUserGroupsRequests", `Request: ${JSON.stringify(getUserGroupsRequests)}`);
        let getUserGroupsResponse = await queryRDS(getUserGroupsRequests);
        if (getUserGroupsResponse.error !== 0) {
            return getUserGroupsResponse;
        }

        log("main", "getUserGroupsResponse", `Response: ${JSON.stringify(getUserGroupsResponse)}`);
        let parsedResponse = parseRDSResponse(getUserGroupsResponse.body, params.email);

        return buildResponse(0, 200,
            log("main", "Response Msg", `Retrieved Groups: ${JSON.stringify(parsedResponse)}`),
            parsedResponse,
            {
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            });
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err", `Error in Get Users Group  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ GetUserGroups - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}