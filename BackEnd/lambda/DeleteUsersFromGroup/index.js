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
        group_id: request.body.group_id,
        users: request.body.params.users
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

function formatInputForRDS(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "DELETE_USERS_FROM_GROUP",
        body: {
            group_id: request.group_id,
            users: request.users
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
            warn("queryRDS", "err response", `error deleting users from group: ${JSON.stringify(err.stack)}`));
    }
}

//==================================================================================================

//==================================================================================================
//GetGroupLambda Functions

function formatInputForGetGroup(event) {
    return {
        headers: event.headers,
        body: {
            group_id: event.body.group_id
        }
    };
}

async function callGetGroupLambda(request) {
    const params = {
        FunctionName: "GetGroup",
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(request),
    };

    log("callGetGroupLambda", "After params", `params: ${JSON.stringify(params)}`);

    try {
        let response = await lambda.invoke(params).promise();
        log("callGetGroupLambda", "success response", `retrieved users from group: ${JSON.parse(response.Payload)}`);
        return JSON.parse(response.Payload);
    } catch (err) {
        return buildResponse(1, 500,
            warn("callGetGroupLambda", "err response", `error retrieving group: ${JSON.stringify(err.stack)}`));
    }
}

//==================================================================================================

exports.handler = async (event, context) => {
    try {
        requestID = context.awsRequestId;
        useremail = event.headers.user || "unknown";

        log("main", "received event", `got event ${JSON.stringify(event)}`);

        if (!event.headers) {
            return buildResponse(2, 400,
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

        if (!event.body.group_id) {
            return buildResponse(4, 400,
                warn("main", "event.body.group_id", `Missing group_id, query: ${JSON.stringify(event)}`));
        } else if (!Number.isInteger(event.body.group_id)) {
            return buildResponse(4, 400,
                warn("main", "event.body.group_id", `group_id should be an integer: ${JSON.stringify(event)}`));
        }

        //Had to had params sub_object for group<id> endpoint
        if (!event.body.params) {
            return buildResponse(4, 400,
                warn("main", "event.body.params", `Missing body.params, query: ${JSON.stringify(event)}`));
        }

        if (!Object.prototype.toString.call(event.body.params.users) === '[object Array]') {
            return buildResponse(4, 400,
                warn("main", "event.body.params check", `Users should be an array, query: ${JSON.stringify(event)}`));
        }

        if (event.body.params.users.length === 0) {
            return buildResponse(4, 400,
                warn("main", "event.body.params check",
                    `Users array should contain at least one user, query: ${JSON.stringify(event)}`));
        }

        for (let user of event.body.params.users) {
            if (!user.email) {
                return buildResponse(4, 400,
                    warn("main", "event.body.params.users loop", `Missing user email object for invitee: ${JSON.stringify(user)}`));
            }
            if (typeof user.email !== "string") {
                return buildResponse(4, 400,
                    warn("main", "event.body.params.users loop", `user should be a string: ${JSON.stringify(user)}`));
            }
        }

        let params = parseInput(event);

        //Check that group exists
        let getGroupRequest = formatInputForGetGroup(event);
        log("main", "getGroupRequest", `Request: ${JSON.stringify(getGroupRequest)}`);
        let getGroupResponse = await callGetGroupLambda(getGroupRequest);
        if (getGroupResponse.error !== 0) {
            return getGroupResponse;
        }
        log("main", "getGroupResponse", `Response: ${JSON.stringify(getGroupResponse)}`);

        let deleteUsersFromGroupRequest = formatInputForRDS(params);
        log("main", "deleteUsersFromGroupRequest", `Request: ${JSON.stringify(deleteUsersFromGroupRequest)}`);
        let deleteUsersFromGroupResponse = await queryRDS(deleteUsersFromGroupRequest);
        if (deleteUsersFromGroupResponse.error !== 0) {
            return deleteUsersFromGroupResponse;
        }
        log("main", "deleteUsersFromGroupResponse", `Response: ${JSON.stringify(deleteUsersFromGroupResponse)}`);

        getGroupResponse = await callGetGroupLambda(getGroupRequest);
        if (getGroupResponse.error !== 0) {
            return buildResponse(getGroupResponse.error, getGroupResponse.statusCode,
                warn("main", "response", `Users removed from group, but error querying group: ${JSON.stringify(getGroupResponse)}`),
                {},
                {
                    'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                    'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
                });
        }

        return buildResponse(0, 200,
            log("main", "response", `users removed from group Successfully, new group: ${JSON.stringify(getGroupResponse.body)}`),
            getGroupResponse.body,
            {
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            });

    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err", `Error in Delete Users From Group  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ DeleteUsersFromGroup - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}