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

    return {
        tokens: tokens,
        email: request.body.email,
        invitees: request.body.invitees,
        name: request.body.name,
        date: request.body.date
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

function formatResponseBody(request, createMeetingResponse) {
    return {
        host: request.name,
        host_email: request.email,
        meeting_id: createMeetingResponse.meeting_id,
        title: request.title,
        start_time: request.start_time,
        join_url: createMeetingResponse.join_url,
        password: createMeetingResponse.password,
        participants: request.invitees
    };
}


//==================================================================================================
//ZoomAdapter Functions

function formatInputForWebSocket(request) {
    request.timestamp = Date.now();  // for logging/troubleshooting
    request.eventid = useremail; // for logging / troubleshooting
    return {
        FunctionName: "WebSocketHandler",
        Payload: {
            name: "CALL_ALL",
            body: request
        }
    };
}

function formatInputForCreateMeeting(request) {
    return {
        FunctionName: "CreateMeeting",
        Payload: {
            headers: {
                access_token: request.tokens.access_token,
                refresh_token: request.tokens.refresh_token,
                user: useremail
            },
            body: {
                email: request.email,
                invitees: request.invitees,
                title: request.title,
                start_time: request.start_time,
                end_time: request.end_time,
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

        if (!event.body.name) {
            return buildResponse(4, 400,
                warn("main", "event.body.name", `Missing name, query: ${JSON.stringify(event)}`));
        } else if (typeof event.body.name !== "string") {
            return buildResponse(4, 400,
                warn("main", "event.body.name", `name should be a string: ${JSON.stringify(event)}`));
        }

        if (!event.body.date) {
            return buildResponse(4, 400,
                warn("main", "event.body.date", `Missing date, query: ${JSON.stringify(event)}`));
        } else if (typeof event.body.date !== "string") {
            return buildResponse(4, 400,
                warn("main", "event.body.date", `date should be a string: ${JSON.stringify(event)}`));
        }


        if (event.body.start_time && !Number.isInteger(event.body.start_time)) {
            return buildResponse(4, 400,
                warn("main", "event.body.start_time", `if start_time is included, it should be an int: ${JSON.stringify(event)}`));
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

        if (!event.body.invitees) {
            return buildResponse(4, 400,
                warn("main", "event.body.invitees", `Missing invitees list, query: ${JSON.stringify(event)}`));
        }


        const params = parseInput(event);

        const date = event.body.start_time || Date.now() + 60000; // one minute in the future

        const title = `${params.name}'s Meeting -- ${params.date}`;
        const start_time = date;
        const end_time = date + 3600000; // one hour from now, default time
        params.title = title;
        params.start_time = start_time;
        params.end_time = end_time;


        const createMeetingRequest = formatInputForCreateMeeting(params);
        log("main", "CreateMeetingRequest", `Request: ${JSON.stringify(createMeetingRequest)}`);

        const createMeetingResponse = await callLambda(createMeetingRequest);
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

        const responseBody = formatResponseBody(params, createMeetingResponse.body);

        log("main", "after create meeting", `Response Body: ${JSON.stringify(responseBody)}`);

        const websocketRequest = formatInputForWebSocket(responseBody);
        log("main", "websocketRequest", `Request: ${JSON.stringify(websocketRequest)}`);
        const websocketResponse = await callLambda(websocketRequest);
        if (websocketResponse.statusCode !== 200) {
            return buildResponse(1, 500,
                warn("main", "websocketResponse",
                    `Error sending request through websocket ${JSON.stringify(websocketResponse) || "unknown error"}`));
        }

        log("main", "after WS", `WS Response: ${JSON.stringify(websocketResponse)}`);

        return buildResponse(0, 200,
            log("main", "response", `Response Body: ${JSON.stringify(responseBody)}`), responseBody,
            createMeetingResponse.headers);


    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err", `Error in CallAll  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ CallAll - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}