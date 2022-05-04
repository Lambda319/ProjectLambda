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
        meeting_id: request.body.meeting_id,
        tokens: tokens
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

function formatInputForZoomAdapterDeleteMeeting(request) {
    return {
        name: "DELETE_MEETING",
        body: {
            token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            meetingId: request.meeting_id
        }
    };
}

//==================================================================================================


//==================================================================================================
//RDS Functions


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

function formatInputForRDSDeleteMeeting(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "DELETE_MEETING",
        body: {
            meeting_id: request.meeting_id
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

        if (!event.body.meeting_id) {
            return buildResponse(4, 400,
                warn("main", "event.body.meeting_id", `Missing meeting_id, query: ${JSON.stringify(event)}`));
        } else if (!Number.isInteger(event.body.meeting_id)) {
            return buildResponse(4, 400,
                warn("main", "event.body.meeting_id", `meeting_id should be an integer: ${JSON.stringify(event)}`));
        }

        let params = parseInput(event);

        const getMeetingRequest = formatInputForRDSGetMeeting(params);
        log("main", "GetMeetingRequest", `Request: ${JSON.stringify(getMeetingRequest)}`);

        const getMeetingResponse = await queryRDS(getMeetingRequest);
        if (getMeetingResponse.error !== 0) {
            return getMeetingResponse;
        }

        log("main", "getMeetingResponse", `Response: ${JSON.stringify(getMeetingResponse)}`);

        if (getMeetingResponse.body.Status === 1) {
            return buildResponse(1, 400,
                warn("main", "getMeetingResponseStatus", `Can't delete a meeting in progress: ${JSON.stringify(getMeetingResponse)}`));
        } else if (getMeetingResponse.body.Status === 2) {
            return buildResponse(1, 400,
                warn("main", "getMeetingResponseStatus", `Can't delete a meeting that has ended: ${JSON.stringify(getMeetingResponse)}`));
        } else if (getMeetingResponse.body.StartDate < Date.now()) {
            return buildResponse(1, 400,
                warn("main", "getMeetingResponseStartDate", `Can't delete a meeting that is in the past: ${JSON.stringify(getMeetingResponse)}`));
        }


        const zoomRequest = formatInputForZoomAdapterDeleteMeeting(params);
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

        const deleteMeetingRequest = formatInputForRDSDeleteMeeting(params);
        log("main", "DeleteMeetingRequest", `Request: ${JSON.stringify(deleteMeetingRequest)}`);

        const deleteMeetingResponse = await queryRDS(deleteMeetingRequest);
        if (deleteMeetingResponse.error !== 0) {
            return buildResponse(deleteMeetingResponse.error, deleteMeetingResponse.statusCode,
                log("main", "response", `but error deleting from RDS: ${JSON.stringify(deleteMeetingResponse)}`),
                {meeting_id: params.meeting_id},
                {
                    'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                    'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
                });
        }

        return buildResponse(0, 200,
            log("main", "response", `deleted meeting from RDS and Zoom: ${JSON.stringify(deleteMeetingResponse)}`),
            {meeting_id: params.meeting_id},
            {
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            });
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "error",
                `Error Deleting meeting  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ DeleteMeeting - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}