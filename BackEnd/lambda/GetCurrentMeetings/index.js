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
        tokens: tokens,
        email: request.headers.email,
        start_time: +request.headers.start_time,
        end_time: +request.headers.end_time,
        recurse: request.headers.recurse || false
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
//RDS Functions
function formatInputForRDS(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "GET_CURRENT_MEETINGS",
        body: {
            email: request.email,
            start_time: request.start_time,
            end_time: request.end_time,
            recurse: request.recurse
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
            warn("queryRDS", "err response", `error adding users to group: ${JSON.stringify(err.stack)}`));
    }
}


exports.handler = async (event, context, callback) => {
    try {
        requestID = context.awsRequestId;
        useremail = event.headers.user || "unknown";

        if (!event.headers) {
            return buildResponse(4, 400,
                warn("main", "event.headers", `Missing headers, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.access_token || !event.headers.refresh_token) {
            return buildResponse(2, 401,
                warn("main", "event.headers.tokens", `Missing tokens, access denied, query: ${JSON.stringify(event)}`));
        }

        if (event.headers.recurse == null && event.headers.recurse !== false) {
            return buildResponse(4, 400,
                warn("main", "event.headers.recurse", `Missing recurse object, query: ${JSON.stringify(event)}`));
        } else if (event.headers.recurse === 'true') {
            event.headers.recurse = true;
        } else if (event.headers.recurse === 'false') {
            event.headers.recurse = false;
        }
        if (typeof event.headers.recurse !== "boolean") {
            return buildResponse(4, 400,
                warn("main", "event.headers.recurse", `recurse should be a boolean, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.email ) {
            return buildResponse(4, 400,
                warn("main", "event.headers.email", `Missing email object, query: ${JSON.stringify(event)}`));
        }else if (typeof event.headers.email !== "string" ) {
            return buildResponse(4, 400,
                warn("main", "event.headers.email", `email should be a string, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.start_time ) {
            return buildResponse(4, 400,
                warn("main", "event.headers.start_time", `Missing start_time object, query: ${JSON.stringify(event)}`));
        }else if (!Number.isInteger(+event.headers.start_time)) {
            return buildResponse(4, 400,
                warn("main", "event.headers.start_time", `start_time should be a string, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.end_time ) {
            return buildResponse(4, 400,
                warn("main", "event.headers.end_time", `Missing end_time object, query: ${JSON.stringify(event)}`));
        }else if (!Number.isInteger(+event.headers.end_time)) {
            return buildResponse(4, 400,
                warn("main", "event.headers.end_time", `end_time should be a string, query: ${JSON.stringify(event)}`));
        }

        let params = parseInput(event);

        let getCurrentMeetingsRequest = formatInputForRDS(params);
        log("main", "getCurrentMeetingsRequest", `Request: ${JSON.stringify(getCurrentMeetingsRequest)}`);
        let getCurrentMeetingsResponse = await queryRDS(getCurrentMeetingsRequest);
        if (getCurrentMeetingsResponse.error !== 0) {
            return getCurrentMeetingsResponse;
        }
        log("main", "getCurrentMeetingsResponse", `Response: ${JSON.stringify(getCurrentMeetingsResponse)}`);

        return buildResponse(0, 200,
            log("main", "response", `Meetings Retrieved: ${JSON.stringify(getCurrentMeetingsResponse.body)}`),
            getCurrentMeetingsResponse.body,
            {
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            });
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err",
                `Error in GetCurrentMeetings " + ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ GetCurrentMeetings - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}
