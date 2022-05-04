// Lambda for parsing the webhook

const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
AWS.config.region = "us-west-2";

let useremail = "unknown";
let requestID = "no request ID";

function parseInput(request) {
    request.body.invitees = [{email: request.body.email}];

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

function formatInputForRDSAddParticipants(request) {
    return {
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail
        },
        functionName: "ADD_PARTICIPANTS",
        body: {
            invitees: request.body.invitees,
            meeting_id: request.body.id
        }
    };
}

function formatInputForRDSCreateMeeting(request) {
    return {
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: useremail
        },
        functionName: "CREATE_MEETING",
        body: {
            meeting_id: request.body.id,
            topic: request.body.title,
            startTime: request.body.start_time,
            endTime: request.body.end_time,
            email: request.body.email,
            invitees: request.body.invitees,
            url: request.body.url,
            password: request.body.password
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

function formatInputForWebSocket(meetingDetails, request) {
    meetingDetails.eventid = useremail; // for logging / troubleshooting
    meetingDetails.timestamp = request.timestamp; // for logging / troubleshooting
    return {
        FunctionName: "WebSocketHandler",
        Payload: {
            name: "NEW_MEETING",
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

        if (!event.body.title) {
            return buildResponse(4, 400,
                warn("main", "event.body.title", `Missing meeting title, query: ${JSON.stringify(event)}`));
        } else if (typeof event.body.title !== "string") {
            return buildResponse(4, 400,
                warn("main", "event.body.title", `title should be a string: ${JSON.stringify(event)}`));
        }

        if (!event.body.start_time) {
            return buildResponse(4, 400,
                warn("main", "event.body.start_time", `Missing meeting start_time, query: ${JSON.stringify(event)}`));
        } else if (!Number.isInteger(event.body.start_time)) {
            return buildResponse(4, 400,
                warn("main", "event.body.start_time", `start time should be an integer: ${JSON.stringify(event)}`));
        }

        if (!event.body.end_time) {
            return buildResponse(4, 400,
                warn("main", "event.body.end_time", `Missing meeting end_time, query: ${JSON.stringify(event)}`));
        } else if (!Number.isInteger(event.body.end_time)) {
            return buildResponse(4, 400,
                warn("main", "event.body.end_time", `end time should be an integer: ${JSON.stringify(event)}`));
        }

        if (event.body.end_time <= event.body.start_time) {
            return buildResponse(4, 400,
                warn("main", "event.body.end_time", `end time should be after start time: ${JSON.stringify(event)}`));
        }

        const params = parseInput(event);
        log("main", "After Parsing Input", `params ${JSON.stringify(params)}`);

        // A delay to make sure that meeting added inside our application is added into the Database
        await new Promise(r => setTimeout(r, 200));

        const getMeetingRequest = formatInputForGetMeeting(params);
        log("main", "getMeetingRequest", `Request: ${JSON.stringify(getMeetingRequest)}`);

        let getMeetingResponse = await queryRDS(getMeetingRequest);
        log("main", "GetMeetingResponse", `Meeting retrieved, ${JSON.stringify(getMeetingResponse)}`);

        // adding meeting & participants if not existing in the table
        if (getMeetingResponse.error !== 0) {
            warn("main", "getMeetingResponse.error ", `Meeting response error, 
                    ${JSON.stringify(getMeetingResponse)}`);
            if (getMeetingResponse.error === 1 && getMeetingResponse.statusCode === 404) { // Meeting does not exist
                const createMeetingRequest = formatInputForRDSCreateMeeting(params);
                log("main", "CreateMeetingRequest", `Request: ${JSON.stringify(createMeetingRequest)}`);

                const createMeetingResponse = await queryRDS(createMeetingRequest);
                if (createMeetingResponse.error !== 0) {
                    return buildResponse(createMeetingResponse.error, 500,
                        warn("main", "createMeetingResponse", `Meeting created, but SQL Error during query
                        ${JSON.stringify(createMeetingResponse)}`),
                        {},
                        {
                            'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                            'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
                        });
                }

                log("main", "CreateMeetingResponse", `Response: ${JSON.stringify(createMeetingResponse)}`);

                const addParticipantsRequest = formatInputForRDSAddParticipants(params);
                log("main", "AddParticipantsRequest", `Request: ${JSON.stringify(addParticipantsRequest)}`);

                const addParticipantsResponse = await queryRDS(addParticipantsRequest);
                if (addParticipantsResponse.error !== 0) {
                    return buildResponse(addParticipantsResponse.error, 500,
                        warn("main", "addParticipantsResponse", `Meeting created & added to RDS, but SQL Error during addition of participants
                        ${JSON.stringify(addParticipantsResponse)}`),
                        {},
                        {
                            'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                            'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
                        });
                }

                log("main", "AddParticipantsResponse", `Response: ${JSON.stringify(addParticipantsResponse)}`);
            }
        }

        // Response Formation
        const getMeetingDetailsRequest = formatInputForGetMeetingDetails(params);
        log("main", "GetMeetingDetailsRequest", `Request: ${JSON.stringify(getMeetingDetailsRequest)}`);

        const getMeetingDetailsResponse = await queryRDS(getMeetingDetailsRequest);
        if (getMeetingDetailsResponse.error !== 0) {
            return getMeetingDetailsResponse;
        }

        log("main", "getMeetingDetailsResponse", `Meeting Created, forming return response object, Response: ${JSON.stringify(getMeetingDetailsResponse)}`);

        const getMeetingDetailsResponseBody = getMeetingDetailsResponse.body;


        // Call Websockets irrespective of whether the meeting was created in this lambda or not.
        const websocketRequest = formatInputForWebSocket(getMeetingDetailsResponseBody, params);
        log("main", "websocketRequest", `Request: ${JSON.stringify(websocketRequest)}`);
        const websocketResponse = await callLambda(websocketRequest);
        if (websocketResponse.statusCode !== 200) {
            return buildResponse(1, 500,
                warn("main", "websocketResponse",
                    `Error sending request through websocket ${JSON.stringify(websocketResponse) || "unknown error"}`));
        }

        // Make a success response to the Calling Lambda - "Webhook-MeetingCreated"
        return buildResponse(0, 200,
            log("main", "Response", `Meeting & Meeting Participants are saved in SQL: ${JSON.stringify(getMeetingDetailsResponse)}`),
            getMeetingDetailsResponseBody);
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err", `Error in CreateMeeting  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ CreateMeeting-WH-Parsing - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}