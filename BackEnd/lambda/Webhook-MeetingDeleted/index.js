// Lambda for receiving a Webhook event and responding to Zoom

const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
AWS.config.region = "us-west-2";

let useremail = "not-set";
let requestID = "no request ID";
let zoom_event_id = "no eventID";

function parseInput(request) {
    let meeting_object = request.payload.object;
    return {
        timestamp: request.event_ts || null,
        meeting: {
            id: +meeting_object.id
        },
    };
}

function buildResponse(errorCode, statusCode, msg, body = {}, headers = {}) {
    return JSON.stringify({
        headers: headers,
        error: errorCode,
        msg: msg,
        statusCode: statusCode,
        body: body
    });
}


//==================================================================================================
//Delete Meeting lambda Functions

function formatInputForDeleteMeeting_WH_Parsing(request) {
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

async function callDeleteMeeting_WH_Parsing(request) {
    const params = {
        FunctionName: "DeleteMeeting_WH_Parsing",
        InvocationType: "Event",
        Payload: JSON.stringify(request),
    };

    log("callDeleteMeeting_WH_Parsing", "After params", `params: ${JSON.stringify(params)}`);

    try {
        let response = await lambda.invoke(params).promise();
        log("callDeleteMeeting_WH_Parsing", "success response", `called lambda successfully : ${JSON.stringify(response)}`);
    } catch (err) {
        return buildResponse(1, 500,
            warn("callDeleteMeeting_WH_Parsing", "err response", `error calling Create Meeting lambda: ${JSON.stringify(err.stack)}`));
    }
}


exports.handler = async (event, context) => {
    log("main", "received event", `got event ${JSON.stringify(event)}`);
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
        } else if (request.event !== 'meeting.deleted') {
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

        // Haven't added any checks for payload.operation, payload.object.occurrences, & payload.object.settings
        useremail = `WH-CM-EM:${request.payload.operator || "unknown"}`;

        useremail += ` WH-MC-ZEID${zoom_event_id}`;
        
        const parsedRequest = parseInput(request);
        log("main", "after parsing request", `object: ${JSON.stringify(parsedRequest)}`);
        const deleteMeetingRequest = formatInputForDeleteMeeting_WH_Parsing(parsedRequest);
        
        await callDeleteMeeting_WH_Parsing(deleteMeetingRequest);

        // responding to Zoom
        log("main", "before returning Zoom Response Object", `done: ${JSON.stringify(deleteMeetingRequest)}`);
        return buildResponse(0, 200,
            log("main", "Zoom Response Object", `done: ${JSON.stringify(deleteMeetingRequest)}`),
            deleteMeetingRequest.body,
            deleteMeetingRequest.headers);
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "error in the catch block of main",
                `Error in Webhook-MeetingDeleted " + ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ Webhook-MeetingDeleted - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}, eventID: ${zoom_event_id}
        logged -- ${log}`;
}