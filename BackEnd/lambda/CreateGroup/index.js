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


//==================================================================================================
//RDS Functions
function formatInputForRDSCreateGroup(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "CREATE_GROUP",
        body: {
            group_name: request.body.group_name
        }
    };
}

function formatInputForRDSInsertGroupOwner(request) {
    return {
        headers: {
            access_token: request.tokens.access_token,
            refresh_token: request.tokens.refresh_token,
            user: useremail
        },
        functionName: "INSERT_GROUP_OWNER",
        body: {
            email: request.body.email,
            group_id: request.body.group_id
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

        if (!event.body.group_name) {
            return buildResponse(4, 400,
                warn("main", "event.body.group_name", `Missing group_name, query: ${JSON.stringify(event)}`));
        } else if (typeof event.body.group_name !== "string") {
            return buildResponse(4, 400,
                warn("main", "event.body.group_name", `group_name should be a string: ${JSON.stringify(event)}`));
        }


        const params = parseInput(event);


        const createGroupRequest = formatInputForRDSCreateGroup(params);
        log("main", "createGroupRequest", `createGroupRequest: ${JSON.stringify(createGroupRequest)}`);
        const createGroupResponse = await queryRDS(createGroupRequest);
        if (createGroupResponse.error !== 0) {
            return buildResponse(createGroupResponse.error, 500,
                warn("main", "createGroupResponse", `createGroupResponse: ${JSON.stringify(createGroupResponse)}`));
        }

        params.body.group_id = createGroupResponse.body.ID;
        const insertGroupOwnerRequest = formatInputForRDSInsertGroupOwner(params);

        log("main", "insertGroupOwnerRequest", `insertGroupOwnerRequest: ${JSON.stringify(insertGroupOwnerRequest)}`);
        const insertGroupOwnerResponse = await queryRDS(insertGroupOwnerRequest);
        if (insertGroupOwnerResponse.error !== 0) {
            return buildResponse(insertGroupOwnerResponse.error, 500,
                warn("main", "insertGroupOwnerResponse", `insertGroupOwnerResponse: ${JSON.stringify(insertGroupOwnerResponse)}`));
        }

        return buildResponse(0, 200,
            log("main", "createGroupResponse", `created group for ${params.body.email} with group_id: ${params.body.group_id} named ${params.body.group_name}`),
            {
                group_id: params.body.group_id,
                group_name: params.body.group_name
            },
            {
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            });

    } catch (err) {
        return buildResponse(1, 500,
            warn("main", "err", `Error in CreateGroup  ${JSON.stringify(err.stack) || "unknown error"}`));
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
    return `[[ CreateGroup - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}