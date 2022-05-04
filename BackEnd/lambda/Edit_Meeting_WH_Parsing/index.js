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
        body: request.body,
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

function formatInputForGetMeetingDetails(request) {
    return {
        functionName: "GET_MEETING_DETAILS",
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

function formatInputForRDSEditMeeting(request) {
    let requestBuilder = {
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail
        },
        functionName: "EDIT_MEETING",
        body: {
            meeting_id: request.body.id,
            topic: request.body.topic,
            start_time: request.body.start_time,
            end_time: request.body.end_time,
            password: request.body.password,
            timestamp: request.timestamp
        }
    };
    return requestBuilder;
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

function formatInputForWebSocket(meetingDetails, request) {
    meetingDetails.eventid = useremail; // for logging / troubleshooting
    meetingDetails.timestamp = request.timestamp; // for logging / troubleshooting
    return {
        FunctionName: "WebSocketHandler",
        Payload: {
            name: "UPDATED_MEETING",
            body: meetingDetails
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

        if (!event.body.email) {
            return buildResponse(4, 400,
                warn("main", "event.body.email", `Missing email, query: ${JSON.stringify(event)}`));
        } else if (typeof event.body.email !== "string") {
            return buildResponse(4, 400,
                warn("main", "event.body.email", `email should be a string: ${JSON.stringify(event)}`));
        }

        if (event.body.topic) {
            if (typeof event.body.topic !== "string") {
                return buildResponse(4, 400,
                    warn("main", "event.body.topic", `topic should be a string: ${JSON.stringify(event)}`));
            }
        }

        if (event.body.start_time) {
            if (!Number.isInteger(event.body.start_time)) {
                return buildResponse(4, 400,
                    warn("main", "event.body.start_time", `start time should be an integer: ${JSON.stringify(event)}`));
            }
        }

        if (event.body.duration) {
            if (!Number.isInteger(event.body.duration)) {
                return buildResponse(4, 400,
                    warn("main", "event.body.duration", `end time should be an integer: ${JSON.stringify(event)}`));
            }
        }

        if (event.body.password) {
            if (typeof event.body.password !== "string") {
                return buildResponse(4, 400,
                    warn("main", "event.body.password", `password should be a string: ${JSON.stringify(event)}`));
            }
        }

        const params = parseInput(event);
        log("main", "After Parsing Input", `params ${JSON.stringify(params)}`);

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
        } while (getMeetingResponse.error !== 0 && attempts <= 3);

        log("main", "GetMeeting Response", `Meeting retrieved, ${JSON.stringify(getMeetingResponse)}`);

        if (event.body.start_time && !event.body.duration) {
            const duration = getMeetingResponse.body.EndDate - getMeetingResponse.body.StartDate;
            params.body.end_time = event.body.start_time + duration;
        } else if (!event.body.start_time && event.body.duration) {
            const start_time = getMeetingResponse.body.StartDate;
            params.body.end_time = start_time + event.body.duration * 60 * 1000;
        } else if (event.body.start_time && event.body.duration) {
            params.body.end_time = event.body.start_time + event.body.duration * 60 * 1000;
        }

        let shouldEditMeeting = getMeetingResponse.body.Timestamp < params.timestamp;

        log("main", "checking timestamp for meeting",
            `timestamp: ${getMeetingResponse.body.Timestamp}, event_ts: ${params.timestamp}`);
        if (shouldEditMeeting) {
            const editMeetingRequest = formatInputForRDSEditMeeting(params);
            log("main", "editMeetingRequest", `Request: ${JSON.stringify(editMeetingRequest)}`);
            const editMeetingResponse = await queryRDS(editMeetingRequest);
            if (editMeetingResponse.error !== 0) {
                return editMeetingResponse;
            }
            log("main", "editMeetingResponse", `Request: ${JSON.stringify(editMeetingResponse)}`);

            // response
            const getMeetingDetailsRequest = formatInputForGetMeetingDetails(params);
            log("main", "getMeetingDetailsRequest", `Request: ${JSON.stringify(getMeetingDetailsRequest)}`);
            const getMeetingDetailsResponse = await queryRDS(getMeetingDetailsRequest);
            if (getMeetingDetailsResponse.error !== 0) {
                return getMeetingDetailsResponse;
            }
            log("main", "getMeetingDetailsResponse", `Request: ${JSON.stringify(getMeetingDetailsResponse)}`);

            const getMeetingDetailsResponseBody = getMeetingDetailsResponse.body;

            const websocketRequest = formatInputForWebSocket(getMeetingDetailsResponseBody, params);
            log("main", "websocketRequest", `Request: ${JSON.stringify(websocketRequest)}`);
            const websocketResponse = await callLambda(websocketRequest);
            if (websocketResponse.statusCode !== 200) {
                return buildResponse(1, 500,
                    warn("main", "websocketResponse",
                        `Error sending request through websocket ${JSON.stringify(websocketResponse) || "unknown error"}`));
            }
        }

        return buildResponse(0, 200, log("main", "response", "Meeting Updated Successfully"));
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err", `Error in Edit_Meeting_WH_Parsing  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ Edit_Meeting_WH_Parsing - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}