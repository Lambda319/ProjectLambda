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
        meeting: request.body.meeting,
        participant: request.body.participant
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

function validateParticipantObject(event) {
    if (!event.body.participant) {
        return buildResponse(4, 400,
            warn("main", "event.body.participant", `Missing participant object, query: ${JSON.stringify(event)}`));
    }

    if (!event.body.participant.name) {
        return buildResponse(4, 400,
            warn("main", "event.body.participant.name", `Missing participant name, query: ${JSON.stringify(event)}`));
    } else if (typeof event.body.participant.name !== "string") {
        return buildResponse(4, 400,
            warn("main", "event.body.participant.name", `Participant name should be a string, query: ${JSON.stringify(event)}`));
    }

    if (!event.body.participant.email) {
        return buildResponse(4, 400,
            warn("main", "event.body.participant.email", `Missing participant email, query: ${JSON.stringify(event)}`));
    } else if (typeof event.body.participant.email !== "string") {
        return buildResponse(4, 400,
            warn("main", "event.body.participant.email", `Participant email should be a string, query: ${JSON.stringify(event)}`));
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
            name: "USER_LEFT",
            body: {
                meeting_id: request.meeting.id,
                email: request.participant.email,
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

function formatInputForGetParticipant(request) {
    return {
        functionName: "GET_PARTICIPANT",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            meeting_id: request.meeting.id,
            email: request.participant.email,
        }
    };
}

function formatInputForAddParticipant(request) {
    return {
        functionName: "ADD_PARTICIPANT",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            meeting_id: request.meeting.id,
            email: request.participant.email,
            attended: true,
            was_invited: false,
            is_in_meeting: true,
            timestamp: request.timestamp
        }
    };
}

function formatInputForUpdateParticipant(request) {
    return {
        functionName: "UPDATE_PARTICIPANT",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            meeting_id: request.meeting.id,
            email: request.participant.email,
            attended: true,
            is_in_meeting: false,
            timestamp: request.timestamp
        }
    };
}

function formatInputForGetUserStatus(request) {
    return {
        functionName: "GET_USER_STATUS",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            email: request.email,
        }
    };
}

function formatInputForUpdateUserLocation(request) {
    return {
        functionName: "UPDATE_USER_LOCATION",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail,
        },
        body: {
            meeting_id: 0,
            email: request.participant.email,
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

        const participantIsValid = validateParticipantObject(event);
        if (!participantIsValid.success) {
            return participantIsValid;
        }


        let parsedRequest = parseInput(event);

        const getUserStatusRequest = formatInputForGetUserStatus(parsedRequest.participant);
        log("main", "getUserStatusRequest", `Request: ${JSON.stringify(getUserStatusRequest)}`);
        const getUserStatusResponse = await queryRDS(getUserStatusRequest);
        if (getUserStatusResponse.error !== 0) {
            return getUserStatusResponse;
        }

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

        const getParticipantRequest = formatInputForGetParticipant(parsedRequest);
        log("main", "getParticipantRequest", `Request: ${JSON.stringify(getParticipantRequest)}`);
        const getParticipantResponse = await queryRDS(getParticipantRequest);
        if (getParticipantResponse.error !== 0) {
            if (getParticipantResponse.error === 1 && getParticipantResponse.statusCode === 404) { // Participant DNE
                log("main", "getParticipantResponse", `Participant not found, adding: ${JSON.stringify(getParticipantResponse)}`);

                const addParticipantRequest = formatInputForAddParticipant(parsedRequest);
                log("main", "addParticipantRequest", `Request: ${JSON.stringify(addParticipantRequest)}`);
                const addParticipantResponse = await queryRDS(addParticipantRequest);
                if (addParticipantResponse.error !== 0) {
                    return addParticipantResponse;
                }
                log("main", "addParticipantResponse", `Participant added successfully: ${JSON.stringify(addParticipantResponse)}`);
            } else {
                return getParticipantResponse;
            }
        } else { // participant exists, update in RDS
            const updateParticipantRequest = formatInputForUpdateParticipant(parsedRequest);
            log("main", "updateParticipantRequest", `Request: ${JSON.stringify(updateParticipantRequest)}`);
            const updateParticipantResponse = await queryRDS(updateParticipantRequest);
            if (updateParticipantResponse.error !== 0) {
                return updateParticipantResponse;
            }
            log("main", "updateParticipantResponse", `participant updated successfully, ${JSON.stringify(updateParticipantResponse)}`);
        }

        log("main", "getUserStatusResponse", `response: ${JSON.stringify(getUserStatusResponse)}`);


        let shouldUpdateUserLocation = getUserStatusResponse.body.meeting_loc_timestamp < parsedRequest.timestamp;
        log("main", "checking timestamp for user location",
            `timestamp: ${getUserStatusResponse.body.meeting_loc_timestamp}, event_ts: ${parsedRequest.timestamp}`);
        if (shouldUpdateUserLocation) {
            const updateUserLocationRequest = formatInputForUpdateUserLocation(parsedRequest);
            log("main", "updateUserLocationRequest", `Request: ${JSON.stringify(updateUserLocationRequest)}`);
            const updateUserLocationResponse = await queryRDS(updateUserLocationRequest);
            if (updateUserLocationResponse.error !== 0) {
                return updateUserLocationResponse;
            }
            log("main", "updateUserLocationResponse", `Request: ${JSON.stringify(updateUserLocationResponse)}`);

            const websocketRequest = formatInputForWebSocket(parsedRequest);
            log("main", "websocketRequest", `Request: ${JSON.stringify(websocketRequest)}`);
            const websocketResponse = await callLambda(websocketRequest);
            if (websocketResponse.statusCode !== 200) {
                return buildResponse(1, 500,
                    warn("main", "websocketResponse",
                        `Error sending request through websocket ${JSON.stringify(websocketResponse) || "unknown error"}`));
            }
        }

        return buildResponse(0, 200, log("main", "response", "user status & meeting loc updated successfully"));
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err",
                `Error in Webhook-ParticipantLeft + ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ ParticipantLeft - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}, logged -- ${log}`;
}
