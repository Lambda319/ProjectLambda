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
        meeting_id: request.body.meeting_id,
        email: request.body.params.email,
        title: request.body.params.title,
        start_time: request.body.params.start_time,
        end_time: request.body.params.end_time,
        invitees: request.body.params.invitees
    };

    log("parseInput", "Before Returning params", `params: ${params}`);

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
//ZoomAdapter Functions
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

function formatInputForZoomAdapterEditMeeting(request) {
    let requestBuilder = {
        name: "EDIT_MEETING",
        body: {
            token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            meetingID: request.meeting_id,
            email: request.email,
            topic: request.title,
            startTime: request.start_time,
            endTime: request.end_time
        }
    };
    return requestBuilder;
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


//==================================================================================================
//RDS Functions

function formatInputForGetMeetingDetails(request) {
    return {
        functionName: "GET_MEETING_DETAILS",
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail,
        },
        body: {
            meeting_id: request.meeting_id,
        }
    };
}

function formatInputForRDSGetMeeting(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "GET_MEETING",
        body: {
            meeting_id: request.meeting_id
        }
    };
}

function formatInputForRDSDeleteMeetingParticipant(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "DELETE_MEETING_PARTICIPANTS",
        body: {
            meeting_id: request.meeting_id,
            email: request.email
        }
    };
}

function formatInputForRDSAddMeetingParticipant(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "ADD_PARTICIPANTS",
        body: {
            meeting_id: request.meeting_id,
            email: request.email,
            invitees: request.invitees
        }
    };
}

function formatInputForRDSEditMeeting(request) {
    let requestBuilder = {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "EDIT_MEETING",
        body: {
            meeting_id: request.meeting_id,
            topic: request.title,
            start_time: request.start_time,
            end_time: request.end_time
        }
    };
    return requestBuilder;
}

function formatInputForGetMeetingParticipantsForEditResponse(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "GET_MEETING_PARTICIPANTS_FOR_EDIT_MEETING_RESPONSE",
        body: {
            meeting_id: request.meeting_id,
            email: request.email
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

/**
 *
 *
 * @returns {Promise<{msg, headers: {statusCode}, error}>}
 */
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

        if (!event.body) {
            return buildResponse(4, 400,
                warn("main", "event.body", `Missing body, query: ${JSON.stringify(event)}`));
        }

        if (!event.body.meeting_id) {
            return buildResponse(4, 400,
                warn("main", "event.body.meeting_id", `Missing meeting_id, query: ${JSON.stringify(event)}`));
        } else if (!Number.isInteger(event.body.meeting_id)) {
            return buildResponse(4, 400,
                warn("main", "event.body.meeting_id", `meeting_id should be an integer: ${JSON.stringify(event)}`));
        }

        if (!event.body.params.email) {
            return buildResponse(4, 400,
                warn("main", "event.body.params.email", `Missing email, query: ${JSON.stringify(event)}`));
        } else if (typeof event.body.params.email !== "string") {
            return buildResponse(4, 400,
                warn("main", "event.body.params.email", `email should be a string: ${JSON.stringify(event)}`));
        }

        if (!event.body.params.title) {
            return buildResponse(4, 400,
                warn("main", "event.body.params.title", `Missing title, query: ${JSON.stringify(event)}`));
        } else if (typeof event.body.params.email !== "string") {
            return buildResponse(4, 400,
                warn("main", "event.body.params.title", `title should be a string: ${JSON.stringify(event)}`));
        }

        if (!event.body.params.start_time) {
            return buildResponse(4, 400,
                warn("main", "event.body.params.start_time", `Missing start_time, query: ${JSON.stringify(event)}`));
        } else if (!Number.isInteger(event.body.params.start_time)) {
            return buildResponse(4, 400,
                warn("main", "event.body.params.start_time", `start_time should be an integer: ${JSON.stringify(event)}`));
        }

        if (!event.body.params.end_time) {
            return buildResponse(4, 400,
                warn("main", "event.body.params.end_time", `Missing end_time, query: ${JSON.stringify(event)}`));
        } else if (!Number.isInteger(event.body.params.end_time)) {
            return buildResponse(4, 400,
                warn("main", "event.body.params.end_time", `end_time should be an integer: ${JSON.stringify(event)}`));
        }

        if (event.body.params.invitees) {
            if (!Object.prototype.toString.call(event.body.params.invitees) === '[object Array]') {
                return buildResponse(4, 400,
                    warn("main", "event.body.params.invitees", `Invitees list is not an array, query: ${JSON.stringify(event)}`));
            }
            for (let invitee of event.body.params.invitees) {
                if (!invitee.email) {
                    return buildResponse(4, 400,
                        warn("main", "event.body.params.invitees loop", `Missing invitee email object for invitee: ${JSON.stringify(invitee)}`));
                }
                if (typeof invitee.email !== "string") {
                    return buildResponse(4, 400,
                        warn("main", "event.body.params.invitees loop", `Invitee email should be a string: ${JSON.stringify(invitee)}`));
                }
            }
        } else {
            return buildResponse(4, 400,
                warn("main", "event.body.params.invitees", `Missing Ivitees List, query: ${JSON.stringify(event)}`));
        }

        let params = parseInput(event);

        log("main", "After parseInput", `Params: ${JSON.stringify(params)}`);


        const getMeetingRequest = formatInputForRDSGetMeeting(params);
        log("main", "GetMeetingRequest", `Request: ${JSON.stringify(getMeetingRequest)}`);

        let getMeetingResponse = await queryRDS(getMeetingRequest);
        if (getMeetingResponse.error !== 0) {
            return getMeetingResponse;
        }

        log("main", "getMeetingResponse", `Response: ${JSON.stringify(getMeetingResponse)}`);

        if (getMeetingResponse.body.Status === 1) {
            return buildResponse(1, 400,
                warn("main", "getMeetingResponseStatus", `Can't edit a meeting in progress: ${JSON.stringify(getMeetingResponse)}`));
        } else if (getMeetingResponse.body.Status === 2) {
            return buildResponse(1, 400,
                warn("main", "getMeetingResponseStatus", `Can't edit a meeting that has ended: ${JSON.stringify(getMeetingResponse)}`));
        } else if (getMeetingResponse.body.StartDate < Date.now()) {
            return buildResponse(1, 400,
                warn("main", "getMeetingResponseStartDate", `Can't edit a meeting that is in the past: ${JSON.stringify(getMeetingResponse)}`));
        }

        // check if only meeting participants is edited

        const isOnlyMeetingParticipantsEdited = getMeetingResponse.body.StartDate == event.body.params.start_time
            && getMeetingResponse.body.EndDate == event.body.params.end_time
            && getMeetingResponse.body.Topic == event.body.params.title;

        if (!isOnlyMeetingParticipantsEdited) {
            // Adapting to Zoom Adapter Formatting of EditMeeting

            log("main", "params before zoomRequest", `params : ${JSON.stringify(params)}`);

            const zoomRequest = formatInputForZoomAdapterEditMeeting(params);
            log("main", "Zoom Adapter Request", `Zoom Request: ${JSON.stringify(zoomRequest)}`);

            const zoomResponse = await callZoomAdapter(zoomRequest);

            if (!zoomResponse) {
                return buildResponse(1, 500,
                    warn("main", "Zoom Adapter Response", "Error querying Zoom API - check logs. Zoom Adapter response was null"));
            } else if (zoomResponse.error === 1) {
                return buildResponse(1, 500,
                    warn("main", "Zoom Adapter Response", `Error in Zoom Adapter ${JSON.stringify(zoomResponse)}
                    for query ${JSON.stringify(params.request)}`));
            } else if (zoomResponse.error === 2) {
                return buildResponse(2, 401,
                    warn("main", "Zoom Adapter Response", `Error authenticating with zoom. Refresh needed,
                    access unauthorized ${JSON.stringify(zoomResponse)}`));
            } else if (zoomResponse.error === 3) {
                return buildResponse(3, 500,
                    warn("main", "Zoom Adapter Response", `Internal Error querying Zoom Adapter - Invalid API name,
                    ZA: ${JSON.stringify(zoomResponse)}, query: ${JSON.stringify(params.request)}`));
            } else if (zoomResponse.error === 4) {
                return buildResponse(4, 500,
                    warn("main", "Zoom Adapter Response", `Internal Error querying Zoom Adapter - Malformed Request,
                    ZA: ${JSON.stringify(zoomResponse)}, query: ${JSON.stringify(params.request)}`));
            }

            log("main", "Zoom Adapter Response", `Zoom Response: ${JSON.stringify(zoomResponse)}`);

            if (zoomResponse.token.updated) {
                params.tokens.access_token = zoomResponse.token.access;
                params.tokens.refresh_token = zoomResponse.token.refresh;
            }
        }


        if (event.body.params.invitees.length !== 0) {
            const deleteMeetingParticipantRequest = formatInputForRDSDeleteMeetingParticipant(params);
            log("main", "DeleteMeetingParticipantRequest", `Request: ${JSON.stringify(deleteMeetingParticipantRequest)}`);

            const deleteMeetingParticipantResponse = await queryRDS(deleteMeetingParticipantRequest);
            if (deleteMeetingParticipantResponse.error !== 0) {
                return deleteMeetingParticipantResponse;
            }

            log("main", "DeleteMeetingParticipantRequest", `Response: ${JSON.stringify(deleteMeetingParticipantResponse)}`);

            const addMeetingParticipantsRequest = formatInputForRDSAddMeetingParticipant(params);
            log("main", "AddMeetingParticipantRequest", `Request: ${JSON.stringify(addMeetingParticipantsRequest)}`);

            const addMeetingParticipantsResponse = await queryRDS(addMeetingParticipantsRequest);
            if (addMeetingParticipantsResponse.error !== 0) {
                return addMeetingParticipantsResponse;
            }

            log("main", "AddMeetingParticipantRequest", `Response: ${JSON.stringify(addMeetingParticipantsResponse)}`);
        }

        if (isOnlyMeetingParticipantsEdited) {
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

        const editMeetingRequest = formatInputForRDSEditMeeting(params);
        log("main", "EditMeetingRequest", `Request: ${JSON.stringify(editMeetingRequest)}`);

        const editMeetingResponse = await queryRDS(editMeetingRequest);
        if (editMeetingResponse.error !== 0) {
            return editMeetingResponse;
        }

        log("main", "EditMeetingResponse", `Response: ${JSON.stringify(editMeetingResponse)}`);

        log("main", "GetMeetingRequest", `Request: ${JSON.stringify(getMeetingRequest)}`);

        getMeetingResponse = await queryRDS(getMeetingRequest);
        if (getMeetingResponse.error !== 0) {
            return getMeetingResponse;
        }

        log("main", "getMeetingResponse", `Updating Procedure Completed, forming return response object, Response: ${JSON.stringify(getMeetingResponse)}`);

        const getMeetingResponseBody = getMeetingResponse.body;

        let response = {
            body: {
                meetings: {
                    id: getMeetingResponseBody.ID,
                    title: getMeetingResponseBody.Topic,
                    organizer_email: getMeetingResponseBody.HostEmail,
                    start_time: getMeetingResponseBody.StartDate,
                    end_time: getMeetingResponseBody.EndDate,
                    download_link: getMeetingResponseBody.DownloadLink,
                    join_url: getMeetingResponseBody.JoinURL,
                    password: getMeetingResponseBody.Passcode,
                    status: getMeetingResponseBody.Status
                }
            }
        };

        // Forming response participants section
        const getMeetingParticipantsForEditRequest = formatInputForGetMeetingParticipantsForEditResponse(params);
        log("main", "getMeetingParticipantJoiningUsersRequest", `Updating Procedure Completed, forming return response object, Request: ${JSON.stringify(getMeetingParticipantsForEditRequest)}`);

        const getMeetingParticipantsForEditResponse = await queryRDS(getMeetingParticipantsForEditRequest);
        if (getMeetingParticipantsForEditResponse.error !== 0) {
            return getMeetingParticipantsForEditResponse;
        }

        log("main", "getMeetingParticipantsForEditResponse", `Response: ${JSON.stringify(getMeetingParticipantsForEditResponse)}`);

        response.body.meetings.participants = getMeetingParticipantsForEditResponse.body;
        return buildResponse(0, 200,
            log("main", "Response", `Meeting Updated on Zoom & Meeting and its Participants saved in SQL`),
            response.body,
            {
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            });
    } catch (err) {
        return buildResponse(
            1, 500, warn("main", "response",
                `Error Updating meeting  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ EditMeeting - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}