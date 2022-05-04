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

    request.body.invitees.push({email: request.body.email});

    return {
        tokens: tokens,
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

function formatInputForZoomAdapterCreateMeeting(request) {
    return {
        name: "CREATE_MEETING",
        body: {
            token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            topic: request.body.title,
            startTime: request.body.start_time,
            endTime: request.body.end_time,
            email: request.body.email,
            invitees: request.body.invitees
        }
    };
}

//==================================================================================================


//==================================================================================================
//RDS Functions

function formatInputForRDSAddParticipants(request, zoomResponse) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "ADD_PARTICIPANTS",
        body: {
            invitees: request.body.invitees,
            meeting_id: zoomResponse.meeting_id
        }
    };
}

function formatInputForRDSCreateMeeting(request, zoomResponse) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "CREATE_MEETING",
        body: {
            meeting_id: zoomResponse.meeting_id,
            topic: request.body.title,
            startTime: request.body.start_time,
            endTime: request.body.end_time,
            email: request.body.email,
            invitees: request.body.invitees,
            url: zoomResponse.url,
            password: zoomResponse.password
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

        if (!event.body.invitees) {
            return buildResponse(4, 400,
                warn("main", "event.body.invitees", `Missing invitees list, query: ${JSON.stringify(event)}`));
        }

        if (!Object.prototype.toString.call(event.body.invitees) === '[object Array]') {
            return buildResponse(4, 400,
                warn("main", "event.body.invitees", `Invitees list is not an array, query: ${JSON.stringify(event)}`));
        }

        for (let invitee of event.body.invitees) {
            if (!invitee.email) {
                return buildResponse(4, 400,
                    warn("main", "event.body.invitees loop", `Missing invitee email object for invitee: ${JSON.stringify(invitee)}`));
            }
            if (typeof invitee.email !== "string") {
                return buildResponse(4, 400,
                    warn("main", "event.body.invitees loop", `Invitee email should be a string: ${JSON.stringify(invitee)}`));
            }
        }

        const params = parseInput(event);

        const zoomRequest = formatInputForZoomAdapterCreateMeeting(params);
        log("main", "Zoom Adapter Request", `Zoom Request: ${JSON.stringify(zoomRequest)}`);

        const zoomResponse = await callZoomAdapter(zoomRequest);

        if (!zoomResponse) {
            return buildResponse(1, 500,
                warn("main", "Zoom Adapter Response", "Error querying Zoom API - check logs. Zoom Adapter response was null"));
        }

        if (zoomResponse.error === 1) {
            return buildResponse(1, 500,
                warn("main", "Zoom Adapter Response", `Error in Zoom Adapter ${JSON.stringify(zoomResponse)}
                for query ${JSON.stringify(params.request)}`));
        }

        if (zoomResponse.error === 2) {
            return buildResponse(2, 401,
                warn("main", "Zoom Adapter Response", `Error authenticating with zoom. Refresh needed, 
                access unauthorized ${JSON.stringify(zoomResponse)}`));
        }

        if (zoomResponse.error === 3) {
            return buildResponse(3, 500,
                warn("main", "Zoom Adapter Response", `Internal Error querying Zoom Adapter - Invalid API name, 
                ZA: ${JSON.stringify(zoomResponse)}, query: ${JSON.stringify(params.request)}`));
        }

        if (zoomResponse.error === 4) {
            return buildResponse(4, 400,
                warn("main", "Zoom Adapter Response", `Internal Error querying Zoom Adapter - Malformed Request, 
                ZA: ${JSON.stringify(zoomResponse)}, query: ${JSON.stringify(params.request)}`));
        }

        log("main", "Zoom Adapter Response", `Zoom Response: ${JSON.stringify(zoomResponse)}`);

        if (zoomResponse.token.updated) {
            params.tokens.access_token = zoomResponse.token.access;
            params.tokens.refresh_token = zoomResponse.token.refresh;
        }

        let zoomResponseBody = JSON.parse(zoomResponse.body);
        const createMeetingRequest = formatInputForRDSCreateMeeting(params, zoomResponseBody);
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

        const addParticipantsRequest = formatInputForRDSAddParticipants(params, zoomResponseBody);
        log("main", "AddParticipantsRequest", `Request: ${JSON.stringify(addParticipantsRequest)}`);

        const addParticipantsResponse = await queryRDS(addParticipantsRequest);
        if (addParticipantsResponse.error !== 0) {
            return buildResponse(addParticipantsResponse.error, 500,
                warn("main", "createMeetingResponse", `Meeting created & added to RDS, but SQL Error during addition of participants
                ${JSON.stringify(addParticipantsResponse)}`),
                {},
                {
                    'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                    'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
                });
        }

        log("main", "AddParticipantsResponse", `Response: ${JSON.stringify(addParticipantsResponse)}`);


        return buildResponse(0, 200,
            log("main", "Response", `Meeting Created, Meeting & Participants saved in SQL, ZoomResp: ${JSON.stringify(zoomResponseBody)}`),
            {
                "meeting_id": zoomResponseBody.meeting_id,
                "join_url": zoomResponseBody.url,
                "password": zoomResponseBody.password
            },
            {
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            });
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
    return `[[ CreateMeeting - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}