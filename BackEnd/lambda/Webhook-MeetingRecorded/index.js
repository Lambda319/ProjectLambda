const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
AWS.config.region = "us-west-2";

let useremail = "not-set";
let requestID = "no request ID";
let zoom_event_id = "no eventID";

function parseInput(request, recordings) {
    let meeting = request.payload.object;
    return {
        timestamp: request.event_ts || null,
        meeting: {
            id: +meeting.id,
            recordings: recordings,
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
//ParticipantJoined lambda Functions


function formatInputForMeetingRecorded(request, zoom_event_id) {
    return {
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy", // not really needed
            user: useremail,
            timestamp: request.timestamp, // null -> unknown ts
            authorization: process.env.AUTH_KEY,
            zoom_event_id: zoom_event_id
        },
        body: {
            meeting: request.meeting,
        }
    };
}

async function callMeetingRecorded(request) {
    const params = {
        FunctionName: "MeetingRecorded",
        InvocationType: "Event",
        Payload: JSON.stringify(request),
    };


    log("callMeetingRecorded", "After params", `params: ${JSON.stringify(params)}`);

    try {
        let response = await lambda.invoke(params).promise();
        log("callMeetingRecorded", "success response", `called lambda successfully : ${JSON.stringify(response)}`);
    } catch (err) {
        return buildResponse(1, 500,
            warn("callMeetingRecorded", "err response", `error calling MeetingStarted: ${JSON.stringify(err.stack)}`));
    }
}

//==================================================================================================

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
        } else if (request.event !== 'recording.completed') {
            return buildResponse(4, 400,
                warn("main", "checking event.body.event", `Invalid event received, expected 'recording.completed', request: ${JSON.stringify(request)}`));
        }

        if (!request.payload) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload", `Event received, ignored due to missing payload, request: ${JSON.stringify(request)}`));
        }

        if (!request.payload.object) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object",
                    `Invalid event, missing payload.object, request payload: ${JSON.stringify(request.payload)}`));
        }

        // meeting checks
        if (!request.payload.object.id) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.id",
                    `Invalid event, missing meeting id in event.body.payload.object.id, payload: ${JSON.stringify(request.payload)}`));
        } else if (!Number.isInteger(+request.payload.object.id)) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.id",
                    `Invalid event, meeting id should be an integer, payload: ${JSON.stringify(request.payload)}`));
        }

        useremail = `WH-MR-ID: ${request.payload.object.id}`;

        if (!request.payload.object.share_url) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.share_url",
                    `Invalid event, missing meeting share_url in event.body.payload.object.share_url, payload: ${JSON.stringify(request.payload)}`));
        } else if (typeof request.payload.object.share_url !== "string") {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.share_url",
                    `Invalid event, meeting share_url should be a a string, payload: ${JSON.stringify(request.payload)}`));
        }

        if (!request.payload.object.recording_count && request.payload.object.recording_count !== 0) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.recording_count",
                    `Invalid event, missing meeting recording_count in event.body.payload.object.recording_count, payload: ${JSON.stringify(request.payload)}`));
        } else if (!Number.isInteger(+request.payload.object.recording_count)) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.recording_count",
                    `Invalid event, meeting recording_count should be an integer, payload: ${JSON.stringify(request.payload)}`));
        } else if (+request.payload.object.recording_count <= 0) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.recording_count",
                    `Invalid event, meeting recording_count should be greater than 0 payload: ${JSON.stringify(request.payload)}`));
        }


        if (!request.payload.object.recording_files) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.recording_files",
                    `Invalid event, missing meeting recording_files in event.body.payload.object.recording_files, payload: ${JSON.stringify(request.payload)}`));
        } else if (!Array.isArray(request.payload.object.recording_files)) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.recording_files",
                    `Invalid event, meeting recording_files should be an array, payload: ${JSON.stringify(request.payload)}`));
        } else if (request.payload.object.recording_files.length <= 0) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.recording_files",
                    `Invalid event, meeting recording_files should be an array with at least one element, payload: ${JSON.stringify(request.payload)}`));
        }

        let recordings = [];

        for (let recording of request.payload.object.recording_files) {
            let start_time = +new Date(recording.recording_start).getTime();
            let play_url = recording.play_url;
            if (start_time && Number(start_time)
                && play_url && typeof play_url === "string") {
                recordings.push({
                    start_time: start_time,
                    play_url: play_url
                });
            }
        }

        if (recordings.length <= 0) {
            return buildResponse(4, 400,
                warn("main", "checking event.body.payload.object.recording_files",
                    `Invalid event, no valid recording file found, payload: ${JSON.stringify(request.payload)}`));
        }


        log("main", "after parsing body", `payload: ${JSON.stringify(request.payload)}`);
        log("main", "after parsing body", `object: ${JSON.stringify(request.payload.object)}`);

        const parsedRequest = parseInput(request, recordings);

        const meetingRecordedRequest = formatInputForMeetingRecorded(parsedRequest, zoom_event_id);

        await callMeetingRecorded(meetingRecordedRequest);

        return buildResponse(0, 200,
            log("main", "response", `done: ${JSON.stringify(meetingRecordedRequest)}`),
            meetingRecordedRequest.body,
            meetingRecordedRequest.headers);
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err",
                `Error in Webhook-MeetingRecorded " + ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ Webhook-MeetingRecorded - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}, eventID: ${zoom_event_id}
        logged -- ${log}`;
}