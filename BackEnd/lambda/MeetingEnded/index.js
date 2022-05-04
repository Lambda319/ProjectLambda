const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
AWS.config.region = "us-west-2";

let useremail = "not-set";
let requestID = "no request ID";
let zoom_event_id = "no eventID";

function parseInput(request) {
    return {
        headers: request.headers,
        timestamp: request.headers.timestamp || Date.now(),
        meeting: request.body.meeting
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
//Error checking Functions
function validateMeetingObject(event) {
    if (!event.body.meeting) {
        return buildResponse(4, 400,
            warn("main", "event.body.meeting", `Missing meeting object, query: ${JSON.stringify(event)}`));
    }

    if (!event.body.meeting.id) {
        return buildResponse(4, 400,
            warn("main", "event.body.meeting.id", `Missing meeting id, query: ${JSON.stringify(event)}`));
    } else if (!Number.isInteger(event.body.meeting.id)) {
        return buildResponse(4, 400,
            warn("main", "event.body.meeting.id", `meeting id should be an int, query: ${JSON.stringify(event)}`));
    }
    return {success: true};
}

//==================================================================================================


//==================================================================================================
//Other Lambda Functions

function formatInputForWebSocket(request) {
    return {
        FunctionName: "WebSocketHandler",
        Payload: {
            name: "MEETING_END",
            body: {
                meeting_id: request.meeting.id,
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

//==================================================================================================
//RDS Functions

function formatInputForGetMeeting(request) {
    return {
        functionName: "GET_MEETING",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            meeting_id: request.id,
        }
    };
}

function formatInputForUpdateMeetingStatus(request) {
    return {
        functionName: "UPDATE_MEETING_STATUS",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            meeting_id: request.meeting.id,
            status: 2, // meeting has ended
            timestamp: request.timestamp
        }
    };
}

function formatInputForUpdateAllMeetingParticipants(request) {
    return {
        functionName: "UPDATE_ALL_MEETING_PARTICIPANTS",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            meeting_id: request.meeting.id,
            timestamp: request.timestamp
        }
    };
}

function formatInputForUpdateUserStatusForMeeting(request) {
    return {
        functionName: "UPDATE_ALL_USER_STATUS_FOR_MEETING",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            meeting_id: request.meeting.id,
            timestamp: request.timestamp
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

exports.handler = async (event, context) => {
    log("main", "received event", `got event ${JSON.stringify(event)}`);
    try {
        requestID = context.awsRequestId;
        zoom_event_id = event.headers.zoom_event_id || "no request ID";
        useremail = event.headers.user + " " + zoom_event_id || "unknown";

        if (!event.headers) {
            return buildResponse(2, 400,
                warn("main", "event.headers", `Missing headers, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.access_token || !event.headers.refresh_token) {
            return buildResponse(2, 401,
                warn("main", "event.headers.tokens", `Missing tokens, access denied, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.authorization) {
            return buildResponse(2, 401,
                warn("main", "event.headers.authorization", `Missing authorization code, access denied, query: ${JSON.stringify(event)}`));
        } else if (event.headers.authorization !== process.env.AUTH_KEY) {
            return buildResponse(2, 401,
                warn("main", "event.headers.authorization", `Invalid authorization code, access denied, query: ${JSON.stringify(event)}`));
        }

        if (!event.body) {
            return buildResponse(4, 400,
                warn("main", "event.body", `Missing body, query: ${JSON.stringify(event)}`));
        }

        const meetingIsValid = validateMeetingObject(event);
        if (!meetingIsValid.success) {
            return meetingIsValid;
        }

        let parsedRequest = parseInput(event);


        const getMeetingRequest = formatInputForGetMeeting(parsedRequest.meeting);
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

        let shouldUpdateMeetingStatus = getMeetingResponse.body.Timestamp < parsedRequest.timestamp;

        log("main", "checking timestamp for meeting",
            `timestamp: ${getMeetingResponse.body.Timestamp}, event_ts: ${parsedRequest.timestamp}`);
        if (shouldUpdateMeetingStatus) {
            const updateMeetingStatusRequest = formatInputForUpdateMeetingStatus(parsedRequest);
            log("main", "updateMeetingStatusRequest", `Request: ${JSON.stringify(updateMeetingStatusRequest)}`);
            const updateMeetingStatusResponse = await queryRDS(updateMeetingStatusRequest);
            if (updateMeetingStatusResponse.error !== 0) {
                return updateMeetingStatusResponse;
            }
            log("main", "updateMeetingStatusResponse", `Request: ${JSON.stringify(updateMeetingStatusResponse)}`);

            const updateAllMeetingParticipantsRequest = formatInputForUpdateAllMeetingParticipants(parsedRequest);
            log("main", "updateAllMeetingParticipantsRequest", `Request: ${JSON.stringify(updateAllMeetingParticipantsRequest)}`);
            const updateAllMeetingParticipantsResponse = await queryRDS(updateAllMeetingParticipantsRequest);
            if (updateAllMeetingParticipantsResponse.error !== 0) {
                return updateAllMeetingParticipantsResponse;
            }
            log("main", "updateAllMeetingParticipantsResponse", `Request: ${JSON.stringify(updateAllMeetingParticipantsResponse)}`);

            const updateUserStatusForMeetingRequest = formatInputForUpdateUserStatusForMeeting(parsedRequest);
            log("main", "updateUserStatusForMeetingRequest", `Request: ${JSON.stringify(updateUserStatusForMeetingRequest)}`);
            const updateUserStatusForMeetingResponse = await queryRDS(updateUserStatusForMeetingRequest);
            if (updateUserStatusForMeetingResponse.error !== 0) {
                return updateUserStatusForMeetingResponse;
            }
            log("main", "updateUserStatusForMeetingResponse", `Request: ${JSON.stringify(updateUserStatusForMeetingResponse)}`);

            const websocketRequest = formatInputForWebSocket(parsedRequest);
            log("main", "websocketRequest", `Request: ${JSON.stringify(websocketRequest)}`);
            const websocketResponse = await callLambda(websocketRequest);
            if (websocketResponse.statusCode !== 200) {
                return buildResponse(1, 500,
                    warn("main", "websocketResponse",
                        `Error sending request through websocket ${JSON.stringify(websocketResponse) || "unknown error"}`));
            }
        }

        return buildResponse(0, 200, log("main", "response", "Meeting Status Updated Successfully"));
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err",
                `Error in Webhook-MeetingEnded + ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ MeetingEnded - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}, logged -- ${log}`;
}
