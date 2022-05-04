const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
AWS.config.region = "us-west-2";

let useremail = "not-set";
let requestID = "no request ID";
let zoom_event_id = "no eventID";

function parseInput(request) {
    let meeting = request.payload;
    let meeting_object = request.payload.object;
    const start_time = +(new Date(meeting_object.start_time));
    // const end_time = meeting_object.duration*60000 + start_time;
    let parsedInput = {
        timestamp: request.event_ts || null,
        meeting: {
            id: +meeting_object.id,
            email: meeting.operator, // host_email
        },
    };
    if(meeting_object.topic){
        parsedInput.meeting.topic = meeting_object.topic;
    }
    if(meeting_object.start_time){
        parsedInput.meeting.start_time = start_time;
    }
    if(meeting_object.duration){
        parsedInput.meeting.duration = meeting_object.duration;
    }
    if(meeting_object.password){
        parsedInput.meeting.password = meeting_object.password;
    }
    return parsedInput;
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
//ParticipantJoined lambda Functions


function formatInputForEditMeeting_WH_Parsing(request) {
    return {
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy", // not really needed
            user: useremail,
            timestamp: request.timestamp, // null -> unknown ts
            authorization: process.env.AUTH_KEY,
        },
        body: request.meeting
    };
}

async function callEditMeeting_WH_Parsing(request) {
    const params = {
        FunctionName: "Edit_Meeting_WH_Parsing",
        InvocationType: "Event",
        Payload: JSON.stringify(request),
    };

    log("callEditMeeting_WH_Parsing", "After params", `params: ${JSON.stringify(params)}`);

    try {
        let response = await lambda.invoke(params).promise();
        log("callEditMeeting_WH_Parsing", "success response", `called lambda successfully : ${JSON.stringify(response)}`);
    } catch (err) {
        return buildResponse(1, 500,
            warn("callEditMeeting_WH_Parsing", "err response", `error calling Create Meeting lambda: ${JSON.stringify(err.stack)}`));
    }
}

//==================================================================================================

exports.handler = async (event, context) => {
    log("main", "received event", `got event ${JSON.stringify(event)}`);
    log("main", "received event", `got event.body ${event.body}`);
    try {
        requestID = context.awsRequestId;

        if (!event.headers || !event.headers.authorization) {
            if (!event.headers.authorization) {
                warn("main", "checking headers", `missing authorization, event: ${JSON.stringify(event)}`);
            }
            return buildResponse(4, 200,
                warn("main", "checking headers", `Event received, ignored due to missing some headers, event: ${JSON.stringify(event)}`));
        } else if (event.headers.authorization !== process.env.AUTH_KEY) {
            return buildResponse(4, 200,
                warn("main", "checking headers", `Event received, ignored due to invalid authorization, event: ${JSON.stringify(event)}`));
        } else if (!event.body) {
            return buildResponse(4, 200,
                warn("main", "checking body", `Event received, ignored due to missing body, event: ${JSON.stringify(event)}`));
        }

        log("main", "after checking headers", `request context: ${JSON.stringify(event.requestContext)}`);
        zoom_event_id = event.requestContext.requestId || "no request ID";

        const request = JSON.parse(event.body);

        if (!request.event) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.event", `Invalid event received, no event type, request: ${JSON.stringify(request)}`));
        } else if (request.event !== 'meeting.updated') {
            return buildResponse(4, 400,
                warn("main", "checking event.body.event", `Invalid event received, expected 'meeting.created', request: ${JSON.stringify(request)}`));
        }     

        if (!request.payload) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload", `Event received, ignored due to missing payload, request: ${JSON.stringify(request)}`));
        }

        if (!request.payload.operator) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.operator",
                    `Invalid event, missing payload.operator, payload object: ${JSON.stringify(request.payload.object)}`));
        } else if (typeof request.payload.operator !== "string") {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.operator",
                    `Invalid event, meeting operator should be a string, payload: ${JSON.stringify(request.payload)}`));
        }

        if (!request.payload.object) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object",
                    `Invalid event, missing payload.object, request payload: ${JSON.stringify(request.payload)}`));
        }

        if (!request.payload.object.id) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.id",
                    `Invalid event, missing payload.object.id, payload object: ${JSON.stringify(request.payload.object)}`));
        } else if (!Number.isInteger(request.payload.object.id)) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.id",
                    `Invalid event, meeting event.body.payload.object.id should be a string, payload: ${JSON.stringify(request.payload)}`));
        }

        if (!request.payload.old_object) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.old_object",
                    `Invalid event, missing payload.old_object, request payload: ${JSON.stringify(request.payload)}`));
        }
        if (request.payload.object.topic) {
            if (typeof request.payload.object.topic !== "string") {
                return buildResponse(4, 400,
                    warn("main", "checking event.body.payload.object.topic",
                        `Invalid event, meeting topic should be a string, payload: ${JSON.stringify(request.payload)}`));
            }
        }

        if (request.payload.object.duration) {
            if (!Number.isInteger(+request.payload.object.duration)) {
                return buildResponse(4, 400,
                    warn("main", "checking event.body.payload.object.duration",
                        `Invalid event, meeting duration should be a Number, payload: ${JSON.stringify(request.payload)}`));
            }
        }

        if (request.payload.object.password) {
            if (typeof request.payload.object.password !== "string") {
                return buildResponse(4, 400,
                    warn("main", "checking event.body.payload.object.password",
                        `Invalid event, meeting password should be a string, payload: ${JSON.stringify(request.payload)}`));
            }
        }

        // Haven't added any checks for payload.operation, payload.object.occurrences, & payload.object.settings
        useremail = `WH-CM-EM:${request.payload.operator || "unknown"}`;

        useremail += ` WH-MC-ZEID${zoom_event_id}`;
        

        log("main", "after parsing body", `payload: ${JSON.stringify(request.payload)}`);
        log("main", "after parsing body", `object: ${JSON.stringify(request.payload.object)}`);

        const parsedRequest = parseInput(request);
        log("main", "after parsing input", `parsedRequest: ${JSON.stringify(parsedRequest)}`);

        const editMeeting_WH_ParsingRequest = formatInputForEditMeeting_WH_Parsing(parsedRequest);

        await callEditMeeting_WH_Parsing(editMeeting_WH_ParsingRequest);

        return buildResponse(0, 200,
            log("main", "response", `done: ${JSON.stringify()}`),
            editMeeting_WH_ParsingRequest.body,
            editMeeting_WH_ParsingRequest.headers);
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err",
                `Error in Webhook-MeetingEdited " + ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ Webhook-MeetingEdited - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}, eventID: ${zoom_event_id}
        logged -- ${log}`;
}