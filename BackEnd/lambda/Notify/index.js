const AWS = require("aws-sdk");
const lambda = new AWS.Lambda();
AWS.config.region = "us-west-2";
const ses = new AWS.SES({region: "us-west-2"});

let useremail = "unknown";
let requestID = "no request ID";

const minutes_35 = 2100;
const minutes_30 = 1800; // seconds
const minutes_20 = 1200;
const minutes_15 = 900;
const minutes_5 = 300;
const minutes_2 = 120;

const NOTIFY_TIME = {
    NOTIFY_15: "NOTIFY_15",
    NOTIFY_30: "NOTIFY_30",
    NOTIFY_NOW: "NOTIFY_NOW"
};

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

//==================================================================================================
//Notification Functions

let notifyCallPromises = [];

async function notify_now_wait(second_until, meeting, params) {
    log("notify_now_wait", "before waiting",
        `waiting for ${second_until} seconds for meeting ${meeting.meeting_id}`);

    notifyCallPromises.push(new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 1000 * (second_until - 30));
    }).then(async () => {
        log("notify_now_wait", "after wait, before fetching meeting", `Request: ${JSON.stringify(meeting)}`);
        const meeting_check = await getMeetingDetails(params, meeting.meeting_id);
        log("notify_now_wait", "fetched meeting", `meeting: ${JSON.stringify(meeting_check)}`);
        let meeting_response = parseMeetingToNotify(meeting_check);
        log("notify_now_wait", "parsed meeting", `meeting: ${JSON.stringify(meeting_response)}`);
        if (meeting_response) {
            return {
                resp: await notify(meeting_response, params, NOTIFY_TIME.NOTIFY_NOW),
                meeting_id: meeting.meeting_id,
                params: params
            };
        }
        return {resp: null, meeting_id: 0};
    }).then(async (ret) => {
        console.log("notify_now_wait", "after notify", `meeting: ${ret.meeting_id}`);
        if (ret.meeting_id === 0) {
            return log("notify_now_wait", "meeting not found/no participants", `meeting: ${JSON.stringify(meeting)}`);
        } else {
            log("notify_now_wait", "meeting found", `meeting: ${JSON.stringify(ret.meeting_id)}`);
            return new Promise((resolve) => {
                setTimeout(() => {
                    log("notify_now_wait", "after timeout", `meeting: ${JSON.stringify(ret.meeting_id)}`);
                    resolve(ret);
                }, 1000 * (minutes_2 - 3));
            }).then(async (ret) => {
                log("notify_now_wait", "In then of nested promise", `meeting: ${JSON.stringify(ret.meeting_id)}`);
                return await email_participants(ret.params, ret.meeting_id, ret.resp);
            });
        }
    }).catch((err) => {
        warn("notify_now_wait", "catch block",
            `err: ${JSON.stringify(err)}`);
    }));
}

async function email_participants(params, meeting_id, resp) {
    const meeting_check = await getMeetingDetails(params, meeting_id);
    log("email_participants", "fetched meeting", `meeting: ${JSON.stringify(meeting_check)}`);
    let meeting_response = parseMeetingToNotify(meeting_check);
    let email = {};

    email.Source = 'notify@zoom-dashboard.tk';

    for (let participant of meeting_response.participants) {
        if (participant.email && !participant.email.includes("fakemail")) {
            email.Message = {
                Subject: {Data: "Meeting Reminder"},
                Body: {
                    Html: {
                        Charset: "UTF-8",
                        Data:
                            `<p>Hi ${participant.name},</p>
                <p>This is a reminder that your meeting ${meeting_response.title} started 2 minutes ago.</p>
                <p>Please join the meeting at <a href="${meeting_response.join_url}">${meeting_response.join_url}</a>.</p>
                <p>Thanks,</p>
                <p>Zoom Dashboard</p>`
                    }
                }
            };
            email.Destination = {
                ToAddresses: [participant.email]
            };
            await ses.sendEmail(email).promise();
            log("email_participants", "sent email", `email: ${JSON.stringify(email)}`);
        }
    }
    return resp + log("email_participants", "sent email", `email: ${JSON.stringify(email)} to ${meeting_response.participants.map(p => p.name)} participants`);
}

function notify_15(second_until, meeting, params) {
    log("notify_15", "before waiting",
        `waiting for ${second_until - minutes_15} seconds for meeting ${meeting.meeting_id}`);

    notifyCallPromises.push(new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 1000 * (second_until - minutes_15 - 3));
    }).then(async () => {
        log("notify_15", "after wait, before fetching meeting", `Request: ${JSON.stringify(meeting)}`);
        const meeting_check = await getMeetingDetails(params, meeting.meeting_id);
        log("notify_15", "fetched meeting", `meeting: ${JSON.stringify(meeting_check)}`);
        let meeting_response = parseMeetingToNotify(meeting_check);
        log("notify_15", "parsed meeting", `meeting: ${JSON.stringify(meeting_response)}`);
        if (meeting_response) {
            return await notify(meeting_response, params, NOTIFY_TIME.NOTIFY_15);
        }
    }).catch((err) => {
        warn("notify_15", "catch block",
            `err: ${JSON.stringify(err)}`);
    }));
}

function notify_30(second_until, meeting, params) {
    log("notify_30", "before waiting",
        `waiting for ${second_until - minutes_30} seconds for meeting ${meeting.meeting_id}`);

    notifyCallPromises.push(new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 1000 * (second_until - minutes_30 - 3));
    }).then(async () => {
        log("notify_30", "after wait, before fetching meeting", `Request: ${JSON.stringify(meeting)}`);
        const meeting_check = await getMeetingDetails(params, meeting.meeting_id);
        log("notify_30", "fetched meeting", `meeting: ${JSON.stringify(meeting_check)}`);
        let meeting_response = parseMeetingToNotify(meeting_check);
        log("notify_30", "parsed meeting", `meeting: ${JSON.stringify(meeting_response)}`);
        if (meeting_response) {
            return await notify(meeting_response, params, NOTIFY_TIME.NOTIFY_30);
        }
    }).catch((err) => {
        warn("notify_30", "catch block",
            `err: ${JSON.stringify(err)}`);
    }));
}

function parseMeetingToNotify(meeting) {
    if (meeting.start_time / 1000 - Date.now() > minutes_5) {
        return null;
    }
    let participants = meeting.participants.filter(p => (p.is_in_meeting === 0 && p.attended === 0));
    return {
        meeting_id: meeting.meeting_id,
        start_time: meeting.start_time,
        title: meeting.title,
        join_url: meeting.join_url,
        participants: participants,
        password: meeting.passcode,
        organizer_email: meeting.organizer_email,
        organizer_host: meeting.organizer_host
    };
}

//==================================================================================================

//==================================================================================================
//Websocket Functions

function formatInputForWebSocket(request, params, notify) {
    request.eventid = useremail;
    request.timestamp = params.timestamp;
    return {
        FunctionName: "WebSocketHandler",
        Payload: {
            name: notify,
            body: request,
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

async function notify(meeting, params, notify) {
    const websocketRequest = formatInputForWebSocket(meeting, params, notify);
    log("main", "websocketRequest", `Request: ${JSON.stringify(websocketRequest)}`);
    const websocketResponse = await callLambda(websocketRequest);
    if (websocketResponse.statusCode !== 200) {
        return buildResponse(1, 500,
            warn("main", "websocketResponse",
                `Error sending request through websocket ${JSON.stringify(websocketResponse) || "unknown error"}`));
    }
    return websocketResponse;
}

//==================================================================================================


//==================================================================================================
//RDS Functions

function formatInputForGetUpcomingMeetings(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "GET_UPCOMING_MEETINGS",
        body: {
            timestamp: request.timestamp
        }
    };
}

function formatInputForGetMeetingDetails(request, meeting_id) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "GET_MEETING_DETAILS",
        body: {
            meeting_id: meeting_id,
            only_absent: true
        }
    };
}

async function getMeetingDetails(params, meeting_id) {
    const getMeetingDetailsRequest = formatInputForGetMeetingDetails(params, meeting_id);
    log("main", "GetMeetingDetailsRequest", `Request: ${JSON.stringify(getMeetingDetailsRequest)}`);

    const getMeetingDetailsResponse = await queryRDS(getMeetingDetailsRequest);
    if (getMeetingDetailsResponse.error !== 0) {
        return buildResponse(getMeetingDetailsResponse.error, 500,
            warn("main", "getMeetingDetailsResponse", `Error fetching meetings from RDS
                ${JSON.stringify(getMeetingDetailsResponse)}`));
    }
    return getMeetingDetailsResponse.body;
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
        let curr_time = Date.now();
        useremail = `Notify-Lambda, ${curr_time}`;

        log("main", "received event", `got event ${JSON.stringify(event)}`);


        const params = {
            tokens: {
                access_token: process.env.JWT,
                refresh_token: "dummy"
            },
            timestamp: curr_time
        };

        const getUpcomingMeetingsRequest = formatInputForGetUpcomingMeetings(params);
        log("main", "GetUpcomingMeetingsRequest", `Request: ${JSON.stringify(getUpcomingMeetingsRequest)}`);

        const getUpcomingMeetingsResponse = await queryRDS(getUpcomingMeetingsRequest);
        if (getUpcomingMeetingsResponse.error !== 0) {
            return buildResponse(getUpcomingMeetingsResponse.error, 500,
                warn("main", "getUpcomingMeetingsResponse", `Error fetching meetings from SQL
                ${JSON.stringify(getUpcomingMeetingsResponse)}`));
        }

        log("main", "getUpcomingMeetingsResponse", `Response: ${JSON.stringify(getUpcomingMeetingsResponse)}`);

        if (!getUpcomingMeetingsResponse.body.meetings) {
            return buildResponse(0, 200,
                log("main", "check upcoming meeting response length",
                    `No meetings returned, will execute again in ~5 minutes: ${JSON.stringify(getUpcomingMeetingsResponse)}`));
        }

        log("main", "Before looking for meetings", "");
        let count_30 = 0, count_15 = 0, count_now = 0;
        for (let meeting of getUpcomingMeetingsResponse.body.meetings) {
            let secondsUntil = (meeting.start_time - curr_time) / 1000;
            if (secondsUntil < minutes_35 && secondsUntil >= minutes_30) {
                notify_30(secondsUntil, meeting, params);
                count_30++;
            } else if (secondsUntil < minutes_20 && secondsUntil > minutes_15) {
                notify_15(secondsUntil, meeting, params);
                count_15++;
            } else if (secondsUntil <= minutes_5) {
                notify_now_wait(secondsUntil, meeting, params);
                count_now++;
            }
        }

        log("main", "After making promises", `found ${count_30 + count_15 + count_now}, meetings. 
        ${count_30} meetings in 30 mins, ${count_15} meetings in 15 mins, ${count_now} meetings starting now.`);

        log("main", "Waiting for promises to resolve", "");
        await Promise.allSettled(notifyCallPromises);
        log("main", "After promises resolved", "");

        return buildResponse(0, 200,
            log("main", "Response", `Retrieved meetings: ${JSON.stringify(getUpcomingMeetingsResponse)}`));
    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err", `Error in Notify  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ Notify - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}