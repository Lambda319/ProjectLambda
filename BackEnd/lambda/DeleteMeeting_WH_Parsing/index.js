// Lambda for parsing the webhook

const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
AWS.config.region = "us-west-2";

let useremail = "unknown";
let requestID = "no request ID";

function parseInput(request) {
    return {
        headers: request.headers,
        timestamp: request.headers.timestamp || Date.now(),
        body: request.body
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

function formatInputForRDSDeleteMeeting(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "DELETE_MEETING",
        body: {
            meeting_id: request.body.id
        }
    };
}

function formatInputForGetMeeting(request) {
    return {
        functionName: "GET_MEETING",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            meeting_id: request.body.id,
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
            warn("queryRDS", "err response", `error querying RDS: ${JSON.stringify(err.stack)}`));
    }
}

//==================================================================================================

//==================================================================================================
// Websocket Functions

function formatInputForWebSocket(request) {
    return {
        FunctionName: "WebSocketHandler",
        Payload: {
            name: "DELETED_MEETING",
            body: {
                id: request.body.id,
                eventid: useremail, // for logging/troubleshooting
                timestamp: request.timestamp // for logging / troubleshooting
            }
        }
    };
}

async function callLambda(request) {
    const params = {
        FunctionName: request.FunctionName,
        InvocationType: request.InvocationType || "RequestResponse",
        Payload: JSON.stringify(request.Payload),
    };

    log(`callLambda ${request.FunctionName}`, "After params", `params: ${JSON.stringify(params)}`);

    try {
        let response = await lambda.invoke(params).promise();
        log(`callLambda ${request.FunctionName}`, "success response", `response : ${JSON.stringify(response)}`);
        return JSON.parse(response.Payload);
    } catch (err) {
        return buildResponse(1, 500,
            warn(`callLambda ${request.FunctionName}`, "err response",
                `error calling ${request.FunctionName}: ${JSON.stringify(err.stack)}`));
    }
}

//==================================================================================================


exports.handler = async (event, context) => {
    try {
        requestID = context.awsRequestId;
        useremail = event.headers.user || "unknown";

        log("main", "received event", `got event ${JSON.stringify(event)}`);

        if (!event.headers) {
            return buildResponse(1, 400,
                warn("main", "event.headers", `Missing headers, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.access_token || !event.headers.refresh_token) {
            return buildResponse(2, 401,
                warn("main", "event.headers.tokens", `Missing tokens, access denied, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.authorization) {
            return buildResponse(4, 200,
                warn("main", "checking headers.authorization", `Event received, ignored due to missing some headers.authorization, event: ${JSON.stringify(event)}`));
        } else if (event.headers.authorization !== process.env.AUTH_KEY) {
            return buildResponse(4, 200,
                warn("main", "checking headers", `Event received, ignored due to invalid authorization, event: ${JSON.stringify(event)}`));
        }

        if (!event.body) {
            return buildResponse(4, 400,
                warn("main", "event.body", `Missing body, query: ${JSON.stringify(event)}`));
        }
        if (!event.body.id) {
            return buildResponse(4, 400,
                warn("main", "event.body.id", `Missing meeting id, query: ${JSON.stringify(event)}`));
        }

        const params = parseInput(event);
        log("main", "After Parsing Input", `params ${JSON.stringify(params)}`);

        // Call Websockets for meeting deleted
        const websocketRequest = formatInputForWebSocket(params);
        log("main", "websocketRequest", `Request: ${JSON.stringify(websocketRequest)}`);
        const websocketResponse = await callLambda(websocketRequest);
        if (websocketResponse.statusCode !== 200) {
            return buildResponse(1, 500,
                warn("main", "websocketResponse",
                    `Error sending request through websocket ${JSON.stringify(websocketResponse) || "unknown error"}`));
        }
        // return buildResponse(0, 200, log("main", "Response", `Meeting Deleted from SQL`));

        // A delay to make sure that meeting added inside our application is added into the Database
        const getMeetingRequest = formatInputForGetMeeting(params);
        log("main", "getMeetingRequest", `Request: ${JSON.stringify(getMeetingRequest)}`);
        let getMeetingResponse;
        let attempts = 1;
        do {
            getMeetingResponse = await queryRDS(getMeetingRequest);
            if (getMeetingResponse.error !== 0) { // User DNE
                if (getMeetingResponse !== 1 || getMeetingResponse.statusCode !== 404) { // some other error
                    return getMeetingResponse;
                } else { // meeting DNE, wait and try again (it is expected that the meeting should eventually be created
                    warn("main", "getMeetingResponse", `Meeting DNE, waiting 2s and trying again. Attempt #${attempts}`);
                    await new Promise(r => setTimeout(r, 2000));
                    attempts++;
                }
            } else {
                break;
            }
        } while (getMeetingResponse.error !== 0 && attempts <= 2);

        log("main", "GetMeeting Response", `Meeting retrieved, ${JSON.stringify(getMeetingResponse)}`);

        // if meeting does exist then delete
        const deleteMeetingRequest = formatInputForRDSDeleteMeeting(params);
        log("main", "DeleteMeetingRequest", `Request: ${JSON.stringify(deleteMeetingRequest)}`);

        const deleteMeetingResponse = await queryRDS(deleteMeetingRequest);
        log("main", "deleteMeetingResponse", `Request: ${JSON.stringify(deleteMeetingRequest)}`);

        if (deleteMeetingResponse.error !== 0) {
            return buildResponse(deleteMeetingResponse.error, deleteMeetingResponse.statusCode,
                log("main", "response", `Error deleting from RDS: ${JSON.stringify(deleteMeetingResponse)}`),
                {meeting_id: params.meeting_id},
                {
                    'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                    'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
                });
        }
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err", `Error in DeleteMeeting_WH_Parsing  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ DeleteMeeting-WH-Parsing - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}