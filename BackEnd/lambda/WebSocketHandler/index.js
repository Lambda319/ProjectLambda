const AWS = require("aws-sdk");
const ENDPOINT = "qm9ci7cj1a.execute-api.us-west-2.amazonaws.com/v1/";
const client = new AWS.ApiGatewayManagementApi({endpoint: ENDPOINT});
const docClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
});
const lambda = new AWS.Lambda();

let requestID = null;
let send = null;
let dynamo = null;
let rds = null;
let routeKey;
let msg = null;
let connectionId = null;
let email = null;
let timestamp = null;

const ACTION_NAME = {
    CONNECT: "$connect",
    DISCONNECT: "$disconnect",
    LOG_IN: "LOG_IN",
    LOG_OUT: "LOG_OUT",
    MEETING_START: "MEETING_START",
    MEETING_END: "MEETING_END",
    USER_JOINED: "USER_JOINED",
    USER_LEFT: "USER_LEFT",
    NEW_MEETING: "NEW_MEETING",
    UPDATED_MEETING: "UPDATED_MEETING",
    DELETED_MEETING: "DELETED_MEETING",
    CALL_ALL: "CALL_ALL",
    NOTIFY_15: "NOTIFY_15",
    NOTIFY_30: "NOTIFY_30",
    NOTIFY_NOW: "NOTIFY_NOW",
    RECORDING: "RECORDING"
};

function buildResponse(errorCode, statusCode, msg, body = {}) {
    return {
        error: errorCode,
        msg: msg,
        statusCode: statusCode,
        body: body,
    };
}

async function sendMessage(email, id, msg) {
    try {
        log("sendMessage", "start of try", `sending ${JSON.stringify(msg)}`);
        await client.postToConnection({
            ConnectionId: id,
            Data: JSON.stringify(msg),
        }).promise();
        log("sendMessage", "sent successfully", `sent ${JSON.stringify(msg)}`);
    } catch (err) {
        warn("sendMessage", "Caught Error", `Error: ${JSON.stringify(err.stack)}`);
        if (err.statusCode === 410) {
            log("sendMessage", "Removing stale connection", `ConnectionID: ${id} for user ${email}`);
            try {
                await removeConnectionIdFromDb(email, id);
                log("sendMessage", "Removed stale connection", `Removed ${id} for user ${email}`);
            } catch (e) {
                send = buildResponse(4, 500, warn("sendMessage", "Unable to delete stale connection", `Error: ${JSON.stringify(err.stack)}`));
            }
        } else {
            send = buildResponse(4, 500, warn("sendMessage", "unknown error", `Error: ${JSON.stringify(err.stack)}`));
        }
    }
}

async function sendMessages(msg) {
    const params = {
        TableName: process.env.DYNAMODB_TABLE,
    };

    try {
        log("sendMessages", "start of try", `sending ${JSON.stringify(msg)}`);
        const rows = await docClient.scan(params).promise();
        log("sendMessages", "retrieved active connection IDs", `there are ${rows.Items.length} connections`);
        const all = rows.Items.map(async (item) => {
            try {
                await sendMessage(item.email, item.connectionId, msg);
            } catch (err) {
                send = buildResponse(4, 500, warn("sendMessages", `unable to send message to ${item.connectionId}`, `Error: ${JSON.stringify(err.stack)}`));
            }
        });
        log("sendMessages", "all messages sent successfully", `sent ${JSON.stringify(msg)} to all`);
        await Promise.all(all);
    } catch (err) {
        send = buildResponse(4, 500, warn("sendMessages", "unable to get connection IDs", `Error: ${JSON.stringify(err.stack)}`));
    }
}

async function storeConnectionIdToDb(email, connectionId) {
    const params = {
        TableName: process.env.DYNAMODB_TABLE,
        Item: {"email": email, "connectionId": connectionId},
    };
    try {
        log("storeConnectionIdToDb", "start of try", `adding ${email} with connection ID ${connectionId}`);
        await docClient.put(params).promise();
        log("storeConnectionIdToDb", "success", `added ${email} with connection ID ${connectionId}`);
    } catch (err) {
        dynamo = buildResponse(4, 500, warn("storeConnectionIdToDb", `unable to store connection ID ${connectionId} with email ${email}`, `Error: ${JSON.stringify(err.stack)}`));
    }
}

async function removeConnectionIdFromDb(email, connectionId) {
    const params = {
        TableName: process.env.DYNAMODB_TABLE,
        Key: {
            email: email,
        },
    };
    try {
        log("removeConnectionIdFromDb", "start of try", `removing ${connectionId}`);
        await docClient.delete(params).promise();
        log("removeConnectionIdFromDb", "removed connection ID from dynamoDB", `removed ${connectionId}`);

        await update_status(connectionId, email, timestamp, false);
        log("removeConnectionIdFromDb", "updated RDS user status", `user: ${email} is offline`);

        log("removeConnectionIdFromDb", "Logging user out", `Email: ${email}`);
        dynamo = await sendMessages({"event": ACTION_NAME.LOG_OUT, "body": {"email": email}});
        log("removeConnectionIdFromDb", "Logged user out", `Email ${email}`);
    } catch (err) {
        dynamo = buildResponse(4, 500, warn("removeConnectionIdFromDb", `unable to remove connection ID ${connectionId}`, `Error: ${JSON.stringify(err.stack)}`));
    }
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
            warn("queryRDS", "err response", `error adding users to group: ${JSON.stringify(err.stack)}`));
    }
}

async function update_status(connectionId, email, timestamp, online) {
    const getUserStatusRequest = {
        functionName: "GET_USER_STATUS",
        headers: {
            access_token: process.env.JWT,
            refresh_token: "dummy",
            user: email
        },
        body: {
            email: email,
        }
    };
    log("update_status", "getting user status", `Request: ${JSON.stringify(getUserStatusRequest)}`);
    const getUserStatusResponse = await queryRDS(getUserStatusRequest);
    if (getUserStatusResponse.error !== 0) {
        rds = getUserStatusResponse;
    }
    const last_updated = getUserStatusResponse.body.online_timestamp;
    if (last_updated < timestamp) {
        log("update_status", "updating user status in RDS", `updated timestamp = ${last_updated}, now = ${timestamp}`);
        const updateUserStatusRequest = {
            functionName: "UPDATE_USER_STATUS",
            headers: {
                access_token: process.env.JWT,
                refresh_token: "dummy",
                user: email
            },
            body: {
                email: email,
                is_online: online,
                timestamp: timestamp,
            }
        };
        log("update_status", "updating user status in RDS", `Request: ${JSON.stringify(updateUserStatusRequest)}`);
        const updateUserStatusResponse = await queryRDS(updateUserStatusRequest);
        if (updateUserStatusResponse.error !== 0) {
            rds = updateUserStatusResponse;
        }
    }
}

exports.handler = async (event, context) => {
    log("main", "entry point", `event: ${JSON.stringify(event)}`);
    log("main", "entry point", `context: ${JSON.stringify(context)}`);

    requestID = context.awsRequestId;
    timestamp = Date.now();

    // called from a lambda fn
    if (event.name) {
        log("main", "setting params from lambda", `event: ${JSON.stringify(event)}`);
        routeKey = event.name;
        msg = event.body;
    }

    // called from a socket client
    else if (event.requestContext) {
        log("main", "setting params from socket", `event: ${JSON.stringify(event)}`);
        connectionId = event.requestContext.connectionId;
        routeKey = event.requestContext.routeKey;
        if (event.body && JSON.parse(event.body).data) {
            email = JSON.parse(event.body).data;
        }
    }

    // somehow invoked outside our system
    else {
        return buildResponse(4, 500, warn("main", "Missing event name or requestContext", `${JSON.stringify(event)} \n ${JSON.stringify(context)}`));
    }

    switch (routeKey) {
        case ACTION_NAME.CONNECT:
            await sendMessages("new client connected");
            break;

        case ACTION_NAME.DISCONNECT:
            send = await sendMessages("client disconnected");
            break;

        case ACTION_NAME.LOG_IN:
            await update_status(connectionId, email, timestamp, true);
            await sendMessages({"event": ACTION_NAME.LOG_IN, "body": {"email": email}});
            if (connectionId !== null) {
                await storeConnectionIdToDb(email, connectionId);
            }
            break;

        case ACTION_NAME.MEETING_START:
            await sendMessages({"event": ACTION_NAME.MEETING_START, "body": msg});
            break;

        case ACTION_NAME.MEETING_END:
            await sendMessages({"event": ACTION_NAME.MEETING_END, "body": msg});
            break;

        case ACTION_NAME.USER_JOINED:
            await sendMessages({"event": ACTION_NAME.USER_JOINED, "body": msg});
            break;

        case ACTION_NAME.USER_LEFT:
            await sendMessages({"event": ACTION_NAME.USER_LEFT, "body": msg});
            break;

        case ACTION_NAME.NEW_MEETING:
            await sendMessages({"event": ACTION_NAME.NEW_MEETING, "body": msg});
            break;

        case ACTION_NAME.UPDATED_MEETING:
            await sendMessages({"event": ACTION_NAME.UPDATED_MEETING, "body": msg});
            break;

        case ACTION_NAME.DELETED_MEETING:
            await sendMessages({"event": ACTION_NAME.DELETED_MEETING, "body": msg});
            break;

        case ACTION_NAME.CALL_ALL:
            await sendMessages({"event": ACTION_NAME.CALL_ALL, "body": msg});
            break;

        case ACTION_NAME.NOTIFY_15:
            await sendMessages({"event": ACTION_NAME.NOTIFY_15, "body": msg});
            break;

        case ACTION_NAME.NOTIFY_30:
            await sendMessages({"event": ACTION_NAME.NOTIFY_30, "body": msg});
            break;

        case ACTION_NAME.NOTIFY_NOW:
            await sendMessages({"event": ACTION_NAME.NOTIFY_NOW, "body": msg});
            break;

        case ACTION_NAME.RECORDING:
            await sendMessages({"event": ACTION_NAME.RECORDING, "body": msg});
            break;
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            send: JSON.stringify(send),
            dynamo: JSON.stringify(dynamo),
            rds: JSON.stringify(rds),
        }),
    };
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
    return `[[ Websocket - ${funcname} ]] -> ${process}, id: ${requestID}
        logged -- ${log}`;
}
