const mysql = require('mysql');
const AWS = require("aws-sdk");
AWS.config.region = "us-west-2";

let useremail = null;
let requestID = null;

//Input Format:
// {
//     tokens: {
//         access_token: "",
//         refresh_token,
//     },
//     functionName: "",
//     body: {
//         arg1: "xx"
//         arg2: "yy"...
//     }
// }


//Output Format:
// {
//     error: 0,// or 1 or 2 or 3 or 4, TBD
//     msg: "",
//     statusCode: 200, // or some error, e.g. 400, 401, 404 500
//     body: {
//         response: {} // contains response from DB, if any
//    }
// }

function INVALID_FCN_ERROR(event) {
    return buildResponse(3, 400, warn("main", "switch default", `Invalid Function Name ${JSON.stringify(event)}`));
}

const FunctionName = {
    //Meetings
    CREATE_MEETING: "CREATE_MEETING", //May also be used for webhook
    DELETE_MEETING: "DELETE_MEETING",
    EDIT_MEETING: "EDIT_MEETING", // may also be used for webhook
    GET_CURRENT_MEETINGS: "GET_CURRENT_MEETINGS",
    GET_ONGOING_MEETINGS: "GET_ONGOING_MEETINGS",
    ADD_PARTICIPANTS: "ADD_PARTICIPANTS",
    GET_MEETING: "GET_MEETING",
    GET_MEETING_DETAILS: "GET_MEETING_DETAILS",
    GET_MEETING_PARTICIPANTS: "GET_MEETING_PARTICIPANTS",
    GET_MEETING_PARTICIPANTS_FOR_EDIT_MEETING_RESPONSE: "GET_MEETING_PARTICIPANTS_FOR_EDIT_MEETING_RESPONSE",
    DELETE_MEETING_PARTICIPANTS: "DELETE_MEETING_PARTICIPANTS",
    UPDATE_MEETING_STATUS: "UPDATE_MEETING_STATUS",
    GET_UPCOMING_MEETINGS: "GET_UPCOMING_MEETINGS",

    INSERT_MEETING_RECORDINGS: "INSERT_MEETING_RECORDINGS",
    UPDATE_MEETING_RECORDING: "UPDATE_MEETING_RECORDING",

    UPDATE_ALL_MEETING_PARTICIPANTS: "UPDATE_ALL_MEETING_PARTICIPANTS",
    UPDATE_ALL_USER_STATUS_FOR_MEETING: "UPDATE_ALL_USER_STATUS_FOR_MEETING",

    UPDATE_PARTICIPANT: "UPDATE_PARTICIPANT",
    ADD_PARTICIPANT: "ADD_PARTICIPANT",
    GET_PARTICIPANT: "GET_PARTICIPANT",

    //Groups
    CREATE_GROUP: "CREATE_GROUP",
    INSERT_GROUP_OWNER: "INSERT_GROUP_OWNER",
    GET_LAST_GROUP_ID: "GET_LAST_GROUP_ID",
    EDIT_GROUP_NAME: "EDIT_GROUP_NAME",
    DELETE_GROUP: "DELETE_GROUP",
    GET_GROUP: "GET_GROUP",
    GET_FAVORITE_GROUP: "GET_FAVORITE_GROUP",

    //Groups/{ID}
    ADD_USERS_TO_GROUP: "ADD_USERS_TO_GROUP",
    DELETE_USERS_FROM_GROUP: "DELETE_USERS_FROM_GROUP",
    GET_USER_GROUPS: "GET_USER_GROUPS",

    //USERS
    GET_USER: "GET_USER",
    GET_USERS: "GET_USERS",
    GET_USER_STATUS: "GET_USER_STATUS",
    UPDATE_USER_LOCATION: "UPDATE_USER_LOCATION",
    UPDATE_USER_NAME: "UPDATE_USER_NAME",

    //Websocket
    UPDATE_USER_STATUS: "UPDATE_USER_STATUS",

    //Webhooks
    PARTICIPANT_JOINED_MEETING: "PARTICIPANT_JOINED_MEETING",
    PARTICIPANT_LEFT_MEETING: "PARTICIPANT_LEFT_MEETING",
    MEETING_STARTED: "MEETING_STARTED",
    MEETING_ENDED: "MEETING_ENDED",
};

function connectToRDB() {
    const connection = mysql.createConnection({
        host: `${process.env.HOST}`, // endpoint from AWS RDS
        user: `${process.env.USER}`, // mySQL username
        password: `${process.env.PW}`, // mySQL password
        database: `${process.env.DB_NAME}` // Our database name as on MySql community
    });

    let response = {
        connection: null,
        error: null
    };

    connection.connect((err) => {
        if (err) {
            response.error = err;
        }
    });
    response.connection = connection;
    return response;
}

async function queryDB(connection, query) {
    return new Promise((resolve, reject) => {
        return connection.query(query, function (error, results, fields) {
            if (error) {
                return reject(error);
            }
            let response = {
                results: null,
                fields: null,
            };
            if (results) {
                response.results = results;
            }
            if (fields) {
                response.fields = fields;
            }
            return resolve(response);
        });
    });
}

function buildResponse(errorCode, statusCode, msg, body = {}) {
    return {
        error: errorCode,
        msg: msg,
        statusCode: statusCode,
        body: body
    };
}

async function performQuery(funcname, request, parser, queryBuilder, onSuccess) {
    let connection;
    let params = "not set";
    let query = "not set";
    try {
        log("PerformQuery", "Start of Try",
            `request from ${funcname} with request ${JSON.stringify(request)}`);

        params = parser(request);
        if (params.errormsg) {
            return buildResponse(4, 400, warn(
                "performQuery", "After parsing",
                `Bad input for function ${funcname}, input: ${JSON.stringify(request)}, msg: ${params.errormsg}`));
        }
        query = queryBuilder(params || {});
        log("PerformQuery", "After Query builder",
            `request from ${funcname} with query ${JSON.stringify(query)}`);

        let dbConnectionResponse = connectToRDB();
        if (dbConnectionResponse.connection === null) {
            return buildResponse(1, 500,
                warn("Perform Query", "After Connect to RDB",
                    `Error connecting to RDS DB. Reason: ${dbConnectionResponse.error}`));
        }

        connection = dbConnectionResponse.connection;
        let response = await queryDB(connection, query);
        return onSuccess(response);
    } catch (err) {
        let errObj = {
            input: JSON.stringify(request),
            params: params,
            query: query,
            reason: err.stack
        };
        return buildResponse(1, 500, warn("Perform Query", "in err",
            `Error performing query: ${JSON.stringify(errObj)}`));
    } finally {
        if (connection) {
            connection.destroy();
        }
    }
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++Meeting Queries+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

//=============================================================================================
//Create Meeting

function parseCreateMeetingRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting ID`};
    }

    if (!request.startTime) {
        return {errormsg: `Missing meeting startTime`};
    }

    if (!request.endTime) {
        return {errormsg: `Missing meeting endTime`};
    }

    if (!request.topic) {
        return {errormsg: `Missing meeting topic`};
    }

    if (!request.email) {
        return {errormsg: `Missing meeting email`};
    }

    if (!request.password) {
        return {errormsg: `Missing meeting password`};
    }

    if (!request.url) {
        return {errormsg: `Missing meeting url`};
    }

    if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting ID should be a 64bit integer`};
    }

    if (!Number.isInteger(request.startTime)) {
        return {errormsg: `Meeting startTime should be an integer`};
    }

    if (!Number.isInteger(request.endTime)) {
        return {errormsg: `Meeting endTime should be an integer`};
    }

    if (typeof request.topic !== "string") {
        return {errormsg: `Meeting topic should be a string`};
    }

    if (typeof request.email !== "string") {
        return {errormsg: `Meeting email should be a string`};
    }

    if (typeof request.password !== "string") {
        return {errormsg: `Meeting password should be a string`};
    }

    if (typeof request.url !== "string") {
        return {errormsg: `Meeting url should be a string`};
    }

    if ((request.endTime <= request.startTime)) {
        return {errormsg: `Meeting endTime should be after meeting startTime`};
    }

    return {
        meeting_id: request.meeting_id,
        startTime: request.startTime,
        endTime: request.endTime,
        topic: request.topic,
        email: request.email,
        password: request.password,
        url: request.url
    };
}

function buildCreateMeetingQuery(params) {
    let values = [
        params.meeting_id,
        params.startTime,
        params.endTime,
        params.topic,
        params.email,
        params.password,
        0, // status not started
        params.url
    ];

    let sql = "INSERT INTO `Data-1`.`Meeting` " +
        "(`ID`,`StartDate`,`EndDate`,`Topic`,`HostEmail`, `Passcode`, `Status`, `JoinURL`) " +
        "VALUES " +
        "(?, ?, ?, ?, ?, ?, ?, ?)";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildCreateMeetingQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}


function createMeetingSuccess(response) {
    return buildResponse(0, 200,
        log("createMeetingSuccess", "Response", `'successfully created meeting'`));
}

//=============================================================================================
//Create Meeting

function parseUpdateMeetingStatusRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting ID`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting ID should be a 64bit integer`};
    }

    if (!request.status && request.status !== 0) {
        return {errormsg: `Missing meeting status`};
    } else if (request.status !== 0 && request.status !== 1 && request.status !== 2) {
        return {errormsg: `meeting status should be 0, 1, or 2, for not started, in progress or ended`};
    }

    if (request.timestamp && !Number.isInteger(request.timestamp)) {
        return {errormsg: `if the timestamp is included, it should be an integer`};
    }

    return {
        meeting_id: request.meeting_id,
        status: request.status,
        timestamp: request.timestamp || Date.now()
    };
}

function buildUpdateMeetingStatusQuery(params) {
    let values = [params.status, params.timestamp, params.meeting_id];

    let sql = "UPDATE Meeting " +
        "SET status = ?, " +
        "Timestamp = ? " +
        "Where ID = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildUpdateMeetingStatusQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}


function updateMeetingStatusSuccess(response) {
    return buildResponse(0, 200,
        log("updateMeetingStatusSuccess", "Response", `'successfully updated meeting status' ${JSON.stringify(response.results)}`));
}


//=============================================================================================


//=============================================================================================

//=============================================================================================
//Add Participants to meeting
//=============================================================================================


function parseAddParticipantsRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting ID`};
    }

    if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting ID should be a 64bit integer`};
    }

    if (!request.invitees) {
        return {errormsg: `Missing list of participants`};
    }

    if (!Object.prototype.toString.call(request.invitees) === '[object Array]') {
        return {errormsg: `Participant list should be an array`};
    }

    if (request.invitees.length === 0) {
        return {errormsg: `Participant list cannot be empty, should at least include the host`};
    }

    for (let invitee of request.invitees) {
        if (!invitee.email) {
            return {errormsg: `Missing invitee email object for invitee ${JSON.stringify(invitee)}`};
        }
        if (typeof invitee.email !== "string") {
            return {errormsg: `invitee email should be a string`};
        }
    }

    return {
        invitees: request.invitees,
        meeting_id: request.meeting_id
    };
}

function buildAddParticipantsQuery(params) {
    let sql = "INSERT IGNORE INTO `Data-1`.`MeetingParticipant` " +
        "(`Email`, `MeetingID`, `WasInvited`, `Attended`) " +
        "VALUES ";

    let values = [];

    for (let invitee of params.invitees) {
        values.push(invitee.email);
        values.push(params.meeting_id);
    }

    if (params.invitees.length > 1) {
        for (let i = 0; i < params.invitees.length - 1; i++) {
            sql += "(?, ?, true, false), ";
        }
    }
    sql += "(?, ?, true, false)";


    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildAddParticipantsQuery", "After Query", `Query: ${JSON.stringify(query)}`);
    return query;
}

function addParticipantsSuccess(response) {
    return buildResponse(0, 200,
        log("addParticipantsSuccess", "Response", `'successfully added participants'`));
}


//=============================================================================================
//Add Participant to meeting
//=============================================================================================


function parseAddParticipantRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting ID`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting ID should be a 64bit integer`};
    }

    if (!request.email) {
        return {errormsg: `Missing email email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `email should be a string`};
    }

    if (request.was_invited === null) {
        return {errormsg: `Missing was_invited`};
    } else if (typeof request.was_invited !== "boolean") {
        return {errormsg: `was_invited should be a boolean`};
    }

    if (request.attended === null) {
        return {errormsg: `Missing attended`};
    } else if (typeof request.attended !== "boolean") {
        return {errormsg: `attended should be a boolean`};
    }

    if (request.is_in_meeting === null) {
        return {errormsg: `Missing is_in_meeting`};
    } else if (typeof request.is_in_meeting !== "boolean") {
        return {errormsg: `is_in_meeting should be a boolean`};
    }

    if (request.timestamp) {
        if (!Number.isInteger(request.timestamp)) {
            return {errormsg: `If timestamp is included, it should be an int`};
        }
    }

    return {
        email: request.email,
        meeting_id: request.meeting_id,
        was_invited: request.was_invited,
        attended: request.attended,
        is_in_meeting: request.is_in_meeting,
        timestamp: request.timestamp || Date.now()
    };
}

function buildAddParticipantQuery(params) {
    let sql = "INSERT IGNORE INTO `Data-1`.`MeetingParticipant` " +
        "(`Email`, `MeetingID`, `WasInvited`, `Attended`, `IsInMeeting`, `Timestamp`) " +
        "VALUES (?, ?, ?, ?, ?, ?)";

    let values = [params.email, params.meeting_id, params.was_invited,
        params.attended, params.is_in_meeting, params.timestamp];

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildAddParticipantQuery", "After Query", `Query: ${JSON.stringify(query)}`);
    return query;
}

function addParticipantSuccess(response) {
    return buildResponse(0, 200,
        log("addParticipantSuccess", "Response", `'successfully added single participant'`));
}

//=============================================================================================
//Get Participant
//=============================================================================================

function parseGetParticipantRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `meeting_id should be an integer`};
    }

    if (!request.email) {
        return {errormsg: `Missing email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `email should be a string`};
    }

    return {
        meeting_id: request.meeting_id,
        email: request.email
    };
}


function buildGetParticipantQuery(params) {
    let values = [params.email, params.meeting_id];
    let sql = "SELECT * FROM `Data-1`.`MeetingParticipant` WHERE Email = ? AND MeetingID = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetParticipantQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getParticipantSuccess(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getParticipantSuccess", "checking results",
                `Error querying for meeting, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0]) {
        return buildResponse(1, 404,
            warn("getParticipantSuccess", "checking results length",
                `No results found for specified meeting ID and email, query response: ${JSON.stringify(response.results)}`));
    }

    return buildResponse(0, 200,
        log("getParticipantSuccess", "Response", `Found participant, response: ${JSON.stringify(response.results[0])}`), response.results[0]);
}

//=============================================================================================
//Update all meeting Participants
//=============================================================================================

function parseUpdateAllMeetingParticipantsRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting ID`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting ID should be a 64bit integer`};
    }

    if (request.timestamp) {
        if (!Number.isInteger(request.timestamp)) {
            return {errormsg: `If timestamp is included, it should be an int`};
        }
    }

    return {
        meeting_id: request.meeting_id,
        timestamp: request.timestamp || Date.now()
    };
}

function buildUpdateAllMeetingParticipantsQuery(params) {
    let values = [params.timestamp, params.meeting_id, params.timestamp];

    let sql = "UPDATE `Data-1`.`MeetingParticipant` p " +
        "SET IsInMeeting = 0, " +
        "Timestamp = ? " +
        "WHERE MeetingID = ? AND p.Timestamp < ? ";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildUpdateAllMeetingParticipantsQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function updateAllMeetingParticipantsSuccess(response) {
    return buildResponse(0, 200,
        log("updateAllMeetingParticipantsSuccess", "Response", `Updated Participants, response: ${JSON.stringify(response.results[0])}`), response.results[0]);
}

//=============================================================================================
//Update all meeting Participants
//=============================================================================================

function parseUpdateAllUserStatusForMeetingRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting ID`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting ID should be a 64bit integer`};
    }

    if (request.timestamp) {
        if (!Number.isInteger(request.timestamp)) {
            return {errormsg: `If timestamp is included, it should be an int`};
        }
    }

    return {
        meeting_id: request.meeting_id,
        timestamp: request.timestamp || Date.now()
    };
}

function buildUpdateAllUserStatusForMeetingQuery(params) {
    let values = [params.timestamp, params.meeting_id, params.timestamp];

    let sql = "UPDATE `Data-1`.`UserStatus` us " +
        "SET MeetingLocation = null, " +
        "MeetingLocationTimestamp = ? " +
        "WHERE MeetingLocation = ? AND us.MeetingLocationTimestamp < ? ";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildUpdateAllUserStatusForMeetingQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function updateAllUserStatusForMeetingSuccess(response) {
    return buildResponse(0, 200,
        log("updateAllUserStatusForMeetingSuccess", "Response", `Updated user statuses, response: ${JSON.stringify(response.results[0])}`), response.results[0]);
}

//=============================================================================================
//Update Participant
//=============================================================================================

function parseUpdateParticipantRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting ID`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting ID should be a 64bit integer`};
    }

    if (!request.email) {
        return {errormsg: `Missing email email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `email should be a string`};
    }

    if (request.attended === null) {
        return {errormsg: `Missing attended`};
    } else if (typeof request.attended !== "boolean") {
        return {errormsg: `attended should be a boolean`};
    }

    if (request.is_in_meeting === null) {
        return {errormsg: `Missing is_in_meeting`};
    } else if (typeof request.is_in_meeting !== "boolean") {
        return {errormsg: `is_in_meeting should be a boolean`};
    }

    if (request.timestamp) {
        if (!Number.isInteger(request.timestamp)) {
            return {errormsg: `If timestamp is included, it should be an int`};
        }
    }

    return {
        email: request.email,
        meeting_id: request.meeting_id,
        attended: request.attended,
        is_in_meeting: request.is_in_meeting,
        timestamp: request.timestamp || Date.now()
    };
}

function buildUpdateParticipantQuery(params) {
    let values = [params.attended, params.is_in_meeting, params.timestamp, // was_invited should never be modified
        params.email, params.meeting_id];

    let sql = "UPDATE `Data-1`.`MeetingParticipant` " +
        "SET Attended = ?, " +
        "IsInMeeting = ?, " +
        "Timestamp = ? " +
        "WHERE Email = ? AND MeetingID = ? ";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildUpdateParticipantQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function updateParticipantSuccess(response) {
    return buildResponse(0, 200,
        log("updateParticipantSuccess", "Response", `Updated Participant, response: ${JSON.stringify(response.results[0])}`), response.results[0]);
}

//=============================================================================================
//Edit Meeting
//=============================================================================================


function parseEditMeetingRequest(request) {
    let parsedRequest = {};
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `meeting_id should be an integer`};
    }
    parsedRequest.meeting_id = request.meeting_id;
    if (request.topic) {
        if (typeof request.topic !== "string") {
            return {errormsg: `meeting topic should be a string`};
        }
        parsedRequest.topic = request.topic;
    }

    if (request.start_time) {
        if (!Number.isInteger(request.start_time)) {
            return {errormsg: `start_time should be an integer`};
        }
        parsedRequest.start_time = request.start_time;
    }

    if (request.end_time) {
        if (!Number.isInteger(request.end_time)) {
            return {errormsg: `end_time should be an integer`};
        }
        parsedRequest.end_time = request.end_time;
    }
    return parsedRequest;
}

function buildEditMeetingQuery(params) {
    let values = [];
    let sql = "UPDATE `Data-1`.`Meeting` SET ";

    if (params.topic) {
        sql += "Topic = ?,";
        values.push(params.topic);
    }
    if (params.start_time) {
        sql += " StartDate = ?,";
        values.push(params.start_time);
    }
    if (params.end_time) {
        sql += " EndDate = ?,";
        values.push(params.end_time);
    }
    if (params.password) {
        sql += "Passcode = ?,";
        values.push(params.password);
    }
    sql += "Timestamp = ?";
    values.push(params.timestamp);

    const condition = " WHERE ID = ?;";
    sql += condition;
    values.push(params.meeting_id);

    const query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildEditMeetingQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function editMeetingSuccess(response) {
    return buildResponse(0, 200,
        log("editMeetingSuccess", "Response", `'Successfully updated meeting', Eesponse: ${JSON.stringify(response)}`));
}

//=============================================================================================
//Delete Meeting
//=============================================================================================

function parseDeleteMeetingRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `meeting_id should be an integer`};
    }


    return {
        meeting_id: request.meeting_id
    };
}

function buildDeleteMeetingQuery(params) {
    let values = [params.meeting_id];
    let sql = "DELETE FROM `Data-1`.`Meeting` WHERE ID = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildDeleteMeetingQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function deleteMeetingSuccess(response) {
    return buildResponse(0, 200,
        log("deleteMeetingSuccess", "Response", `'Successfully deleted meeting'`));
}

//=============================================================================================
//Delete Meeting Participants
//=============================================================================================

function parseDeleteMeetingParticipantRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `meeting_id should be an integer`};
    }
    if (!request.email) {
        return {errormsg: `Missing meeting email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `email should be of type string`};
    }

    return {
        meeting_id: request.meeting_id,
        email: request.email
    };
}

function buildDeleteMeetingParticipantQuery(params) {
    let values = [params.meeting_id, params.email];
    let sql = "DELETE FROM `Data-1`.`MeetingParticipant` WHERE MeetingID = ? AND email NOT LIKE ?;";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildDeleteMeetingQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function deleteMeetingParticipantSuccess(response) {
    return buildResponse(0, 200,
        log("deleteMeetingParticipantSuccess", "Response", `'Successfully deleted meeting participants'`));
}

//=============================================================================================
//Get Meeting
//=============================================================================================

function parseGetMeetingRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `meeting_id should be an integer`};
    }

    return {
        meeting_id: request.meeting_id,
    };
}

function buildGetMeetingQuery(params) {
    let values = [params.meeting_id];
    let sql = "SELECT * FROM `Data-1`.`Meeting` WHERE ID = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetMeetingQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getMeetingSuccess(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getMeetingSuccess", "checking results",
                `Error querying for meeting, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0]) {
        return buildResponse(1, 404,
            warn("getMeetingSuccess", "checking results length",
                `No results found for specified meeting ID, query response: ${JSON.stringify(response.results)}`));
    }

    log("getMeetingSuccess", "before parsing", `results: ${JSON.stringify(response.results)}`);

    if (!response.results[0].ID) {
        return buildResponse(1, 404,
            warn("getMeetingSuccess", "checking results length",
                `No results found for specified meeting ID, query response: ${JSON.stringify(response.results[0])}`));
    }

    return buildResponse(0, 200,
        log("getMeetingSuccess", "Response", `Found meeting, response: ${JSON.stringify(response.results[0])}`), response.results[0]);
}

//=============================================================================================
//Get MeetingDetails
//=============================================================================================

function parseGetMeetingDetailsRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `meeting_id should be an integer`};
    }

    return {
        meeting_id: request.meeting_id,
        only_absent: request.only_absent || false
    };
}

function buildGetMeetingDetailsQuery(params) {
    let values = [params.meeting_id];
    let sql = "SELECT JSON_OBJECT('id', ID, 'start_time', StartDate, 'end_time', EndDate, 'title', Topic, 'organizer_email', HostEmail, " +
        "'download_link', Downloadlink,  'password', Passcode, 'join_url', JoinURL, 'status', m.`Status`, " +
        "        'organizer_host', MeetingHost, " +
        "        'participants', (SELECT JSON_ARRAYAGG(JSON_OBJECT('email', u.email, 'name', CONCAT(FName, ' ' ,LName), 'is_online', IsOnline, " +
        "'was_invited', WasInvited, 'attended', Attended, 'is_in_meeting', IsInMeeting)))) as meeting " +
        "FROM `Data-1`.`MeetingDetails` m " +
        "LEFT JOIN `Data-1`.`MeetingParticipant` p ON p.MeetingID = m.ID " +
        "INNER JOIN `Data-1`.`UserStatus` us ON p.Email = us.Email " +
        "INNER JOIN `Data-1`.`User` u ON u.Email = us.Email " +
        "WHERE ID = ?";

    if (params.only_absent) {
        sql += " AND p.IsInMeeting = 0";
    }

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetMeetingDetailsQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getMeetingDetailsSuccess(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getMeetingDetailsSuccess", "checking results",
                `Error querying for meeting, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0]) {
        return buildResponse(1, 404,
            warn("getMeetingDetailsSuccess", "checking results length",
                `No results found for specified meeting ID, query response: ${JSON.stringify(response.results)}`));
    }

    log("getMeetingSuccess", "before parsing", `results: ${JSON.stringify(response.results)}`);

    if (!response.results[0].meeting) {
        return buildResponse(1, 404,
            warn("getMeetingDetailsSuccess", "checking results length",
                `No results found for specified meeting ID, query response: ${JSON.stringify(response.results[0])}`));
    }

    const parsedResponse = JSON.parse(response.results[0].meeting);

    if (!parsedResponse.id) {
        return buildResponse(1, 404,
            warn("getMeetingDetailsSuccess Parsed", "checking results length",
                `No results found for specified meeting ID, query response: ${JSON.stringify(parsedResponse)}`));
    }

    return buildResponse(0, 200,
        log("getMeetingSuccess", "Response", `Found meeting, response: ${JSON.stringify(parsedResponse)}`), parsedResponse);
}

//=============================================================================================

//=============================================================================================
// Get Meeting Participants
//=============================================================================================
function parseGetMeetingParticipantsForEditResponse(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `meeting_id should be an integer`};
    }
    if (!request.email) {
        return {errormsg: `Missing meeting email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `email should be of type string`};
    }

    return {
        meeting_id: request.meeting_id,
        email: request.email
    };
}

function buildGetMeetingParticipantsForEditResponse(params) {
    let values = [params.email, params.email, params.meeting_id];
    let sql = "SELECT JSON_ARRAYAGG(JSON_OBJECT('email', email, 'name', CONCAT(FName, ' ' ," +
        "LName), 'is_online', IsOnline, 'was_invited', WasInvited, 'attended', Attended, " +
        "'is_in_meeting', IsInMeeting, 'is_favorite', IsFavorite)) as userinfo FROM (SELECT " +
        "MeetingID, u.Email, FName, LName, IsOnline, WasInvited, Attended, IsInMeeting, " +
        "IF(u.email in (SELECT Email FROM `Data-1`.`Favorites` WHERE OwnerID = ?), 1, 0) as " +
        "IsFavorite, ROW_NUMBER() OVER (ORDER BY IF(u.email in (SELECT Email " +
        "FROM `Data-1`.`Favorites` WHERE OwnerID = ?), 1, 0) DESC,  WasInvited DESC, FName, " +
        "LName) FROM `Data-1`.`Meeting` AS m1 LEFT JOIN `Data-1`.`MeetingParticipant` AS p " +
        "ON m1.ID = p.MeetingID INNER JOIN `Data-1`.`User` AS u ON p.Email = u.Email " +
        "LEFT JOIN `Data-1`.`UserStatus` AS us ON us.Email = u.Email " +
        "WHERE m1.ID = ?) x ";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetMeetingParticipantsForEditResponse", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getMeetingParticipantsForEditResponse(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getMeetingParticipantsForEditResponse", "checking results",
                `Error querying for meeting participants, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0]) {
        return buildResponse(1, 404,
            warn("getMeetingParticipantsForEditResponse", "checking results length",
                `No results found for specified meeting ID, query response: ${JSON.stringify(response.results)}`));
    }

    log("getMeetingParticipantsForEditResponse", "before parsing", `results: ${JSON.stringify(response.results)}`);

    return buildResponse(0, 200,
        log("getMeetingParticipantsForEditResponse", "Response", `Found result, response: ${JSON.stringify(response.results)}`), JSON.parse(response.results[0].userinfo));
}

//=============================================================================================
// Get Meeting Participants

function parseGetMeetingParticipantsRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `meeting_id should be an integer`};
    }

    return {
        meeting_id: request.meeting_id,
    };
}

function buildGetMeetingParticipantsQuery(params) {
    let values = [params.meeting_id];
    let sql = "SELECT * FROM `Data-1`.`MeetingParticipant` WHERE MeetingId = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetMeetingParticipantsQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getMeetingParticipantsSuccess(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getMeetingParticipantsSuccess", "checking results",
                `Error querying for meeting participants, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0]) {
        return buildResponse(1, 404,
            warn("getMeetingParticipantsSuccess", "checking results length",
                `No results found for specified meeting ID, query response: ${JSON.stringify(response.results)}`));
    }

    log("getMeetingParticipantsSuccess", "before parsing", `results: ${JSON.stringify(response.results)}`);

    return buildResponse(0, 200,
        log("getMeetingParticipantsSuccess", "Response", `Found meeting, response: ${JSON.stringify(response.results[0])}`), response.results);
}

//=============================================================================================
//=============================================================================================
//Get Current Meetings


function parseGetCurrentMeetingsRequest(request) {
    if (!request.email) {
        return {errormsg: `Missing user email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `Email should be a string`};
    }

    if (request.recurse == null && request.recurse !== false) {
        return {errormsg: "missing recurse parameter"};
    } else if (request.recurse === 'true') {
        request.recurse = true;
    } else if (request.recurse === 'false') {
        request.recurse = false;
    }
    if (typeof request.recurse !== "boolean") {
        return {errormsg: "recurse should be a boolean"};
    }

    if (!request.start_time) {
        return {errormsg: "missing start_time"};
    } else if (!Number.isInteger(request.start_time)) {
        return {errormsg: "start_time should be an integer"};
    }

    if (!request.end_time) {
        return {errormsg: "missing end_time"};
    } else if (!Number.isInteger(request.end_time)) {
        return {errormsg: "end_time should be an integer"};
    }

    return {
        email: request.email,
        start_time: request.start_time,
        end_time: request.end_time,
        recurse: request.recurse
    };
}

function buildGetCurrentMeetingsQuery(params) {
    let email = params.email;
    let start_time = params.start_time;
    let end_time = params.end_time;
    let recurse = params.recurse;

    let values = [email, email, recurse, email, email, start_time, end_time, start_time, end_time];


    log("buildCurrentMeetingsQuery", "Before query", `using pre-defined date range: ${JSON.stringify(params)}`);


    // ------ prepare participants
    let sql = "WITH Participants AS ( " +
        "SELECT MeetingID, u.Email, FName, LName, IsOnline, WasInvited,Attended, IsInMeeting, " +
        "IF(u.email IN (SELECT Email FROM `Data-1`.`Favorites` WHERE OwnerID = ?), 1, 0) AS IsFavorite " + //1. Current User email
        "FROM `Data-1`.`MeetingParticipant` AS p " +
        "INNER JOIN `Data-1`.`User` AS u ON p.Email = u.email " +
        "INNER JOIN `Data-1`.`UserStatus` AS us ON us.Email = u.Email), " +
        // ------------- Emails to use
        "emails as ( " +
        // -------- recursively grab people who are managed by current user
        "WITH RECURSIVE emails (email, n) AS ( " +
        "SELECT distinct  m.EmployeeEmail AS email, 0 " +
        "FROM Manager m " +
        "Where m.ManagerEmail = ? " + // 2. Current user email
        "UNION DISTINCT " +
        "SELECT m1.EmployeeEmail AS email, n+1 " +
        "FROM Manager m1 " +
        "INNER JOIN emails e ON m1.ManagerEmail = e.email) " +
        "SELECT distinct email FROM emails  " +
        "WHERE n = 0 " + // -- stop at first level
        "OR ? is true " + // -- only if query is recursive, 3. recurse (true or false)
        "UNION DISTINCT " + //  -- add people who have the same manager
        "SELECT DISTINCT m2.EmployeeEmail AS email " +
        "FROM Manager m1 JOIN Manager m2 " +
        "WHERE m1.ManagerEmail = m2.ManagerEmail AND (m1.EmployeeEmail <> m2.EmployeeEmail  " +
        "AND m1.EmployeeEmail = ?) " + // 4. Current user email
        "UNION DISTINCT " + //  -- add email of current user
        "SELECT ?) " + // 5. Current user Email
        // ------- build JSON ARRAY
        "SELECT JSON_ARRAYAGG(meetings) AS meetings FROM( " +
        // ------- build individual meeting objects
        "SELECT distinct (JSON_OBJECT('id', ID, 'start_time', StartDate, 'end_time', EndDate, 'title', Topic, 'organizer_email', HostEmail,  " +
        "'download_link', Downloadlink,  'password', Passcode, 'join_url', JoinURL, 'status', `Status`,  " +
        "        'organizer_host', MeetingHost,  " +
        // ----------- build participants array for each meeting
        "        'participants', (SELECT JSON_ARRAYAGG(JSON_OBJECT('email', email, 'name', CONCAT(FName, ' ' ,LName), 'is_online', IsOnline,  " +
        "'was_invited', WasInvited, 'attended', Attended, 'is_in_meeting', IsInMeeting,  " +
        "'is_favorite', IsFavorite)) " +
        "FROM (SELECT *, ROW_NUMBER() OVER (ORDER BY IsFavorite DESC, FName, LName) " +
        "FROM Participants p " +
        "WHERE MeetingID = m.ID)x))) AS meetings " + // x is alias name of sub-result, necessary but not used
        "FROM `Data-1`.`MeetingDetails` AS m " +
        "LEFT JOIN `Data-1`.`MeetingParticipant` AS p ON m.ID = p.meetingID " +
        "RIGHT JOIN emails AS e ON p.Email = e.email " + // -- only select meetings with participants present in emails
        "WHERE ((m.StartDate > ? AND m.StartDate < ?) OR (m.EndDate > ? AND m.EndDate < ?)))x";
    //start range, end range, start range, end range

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildCurrentMeetingsQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getCurrentMeetingsSuccess(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getCurrentMeetingsSuccess", "checking results",
                `Error querying for meeting, query response: ${JSON.stringify(response)}`));
    }

    log("getCurrentMeetingsSuccess", "before results", `results: ${JSON.stringify(response)}`);

    let meetings = [];
    if (response.results.length !== 0 && response.results[0] && response.results[0].meetings) {
        meetings = {meetings: JSON.parse(response.results[0].meetings)};
        return buildResponse(0, 200,
            log("getCurrentMeetingsSuccess", "Response", `Found meeting, response: ${JSON.stringify(meetings)}`), meetings);
    }
    return buildResponse(0, 200,
        log("getCurrentMeetingsSuccess", "Response",
            `No meetings found, returning empty object: ${JSON.stringify(meetings)}`), meetings);
}


function parseGetOngoingMeetingsRequest(request) {
    if (!request.email) {
        return {errormsg: `Missing user email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `Email should be a string`};
    }

    return {
        email: request.email,
    };
}

function buildGetOngoingMeetingsQuery(params) {
    let email = params.email;

    let values = [email];

    // ------ prepare participants
    let sql = "WITH Participants AS (" +
        "SELECT MeetingID, u.Email, FName, LName, IsOnline, WasInvited,Attended, IsInMeeting,  " +
        "IF(u.email IN (SELECT Email FROM `Data-1`.`Favorites` WHERE OwnerID = ?), 1, 0) AS IsFavorite " + // 1.email
        "FROM `Data-1`.`MeetingParticipant` AS p " +
        "INNER JOIN `Data-1`.`User` AS u ON p.Email = u.email " +
        "INNER JOIN `Data-1`.`UserStatus` AS us ON us.Email = u.Email) " +
        "SELECT JSON_ARRAYAGG(meetings) AS meetings FROM( " +
        "SELECT distinct (JSON_OBJECT('id', ID, 'start_time', StartDate, 'end_time', EndDate, 'title', Topic, 'organizer_email', HostEmail, " +
        "'download_link', Downloadlink,  'password', Passcode, 'join_url', JoinURL, 'status', `Status`, " +
        "        'organizer_host', (SELECT Name FROM `Data-1`.`MeetingHost` AS mh WHERE mh.ID = m.ID), " +
        "        'participants', (SELECT JSON_ARRAYAGG(JSON_OBJECT('email', email, 'name', CONCAT(FName, ' ' ,LName), 'is_online', IsOnline, " +
        "'was_invited', WasInvited, 'attended', Attended, 'is_in_meeting', IsInMeeting, " +
        "'is_favorite', IsFavorite)) " +
        "FROM (SELECT *, ROW_NUMBER() OVER (ORDER BY IsFavorite DESC, FName, LName)" +
        "FROM Participants p " +
        "WHERE MeetingID = m.ID)x))) AS meetings " +
        "FROM `Data-1`.`Meeting` AS m " +
        "WHERE m.Status = 1)x;";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildCurrentMeetingsQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getOngoingMeetingsSuccess(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getCurrentMeetingsSuccess", "checking results",
                `Error querying for meeting, query response: ${JSON.stringify(response)}`));
    }

    log("getCurrentMeetingsSuccess", "before results", `results: ${JSON.stringify(response)}`);

    let meetings = [];
    if (response.results.length !== 0 && response.results[0] && response.results[0].meetings) {
        meetings = {meetings: JSON.parse(response.results[0].meetings)};
        return buildResponse(0, 200,
            log("getCurrentMeetingsSuccess", "Response", `Found meeting, response: ${JSON.stringify(meetings)}`), meetings);
    }
    return buildResponse(0, 200,
        log("getCurrentMeetingsSuccess", "Response",
            `No meetings found, returning empty object: ${JSON.stringify(meetings)}`), meetings);
}

//=============================================================================================

//=============================================================================================
//GetUpcomingMeetings

function parseGetUpcomingMeetingsRequest(request) {
    if (!request.timestamp) {
        return {errormsg: `Missing timestamp`};
    } else if (!Number.isInteger(request.timestamp)) {
        return {errormsg: `Timestamp should be an int`};
    }

    return {
        timestamp: request.timestamp
    };
}

function buildGetUpcomingMeetingsQuery(params) {
    let values = [params.timestamp, params.timestamp];

    // ------ prepare participants
    let sql = "SELECT JSON_ARRAYAGG(JSON_OBJECT('meeting_id', ID, 'start_time', StartDate, " +
        "'title', Topic, 'host_email', HostEmail, 'join_url', JoinURL, 'passcode', Passcode, " +
        "'participants', (SELECT JSON_ARRAYAGG(JSON_OBJECT('email', email, 'is_in_meeting', IsInMeeting, 'attended', Attended)) " +
        "FROM MeetingParticipant p " +
        "WHERE p.MeetingID = m.ID))) as meetings " +
        "FROM Meeting m " +
        "Where (StartDate - ?) < 1980000 " + // 33 minutes
        " AND StartDate > ? ";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetUpcomingMeetingsQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getUpcomingMeetingsSuccess(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getUpcomingMeetingsSuccess", "checking results",
                `Error querying for meeting, query response: ${JSON.stringify(response)}`));
    }

    log("getUpcomingMeetingsSuccess", "before results", `results: ${JSON.stringify(response)}`);

    let meetings = [];
    if (response.results.length !== 0 && response.results[0] && response.results[0].meetings) {
        meetings = {meetings: JSON.parse(response.results[0].meetings)};
        return buildResponse(0, 200,
            log("getUpcomingMeetingsSuccess", "Response", `Found meeting, response: ${JSON.stringify(meetings)}`), meetings);
    }
    return buildResponse(0, 200,
        log("getUpcomingMeetingsSuccess", "Response",
            `No meetings found, returning empty object: ${JSON.stringify(meetings)}`), meetings);
}

//=============================================================================================

//=============================================================================================
//InsertMeetingRecordings

function parseInsertMeetingRecordingsRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting_id should be an int`};
    }

    if (!request.recordings) {
        return {errormsg: `Missing recordings`};
    } else if (!Array.isArray(request.recordings)) {
        return {errormsg: `Recordings should be an array`};

    } else if (request.recordings.length === 0) {
        return {errormsg: `Recordings should not be empty`};
    }

    for (let recording of request.recordings) {
        if (!recording.start_time) {
            return {errormsg: `Missing start_time for recording ${JSON.stringify(recording)}`};
        } else if (!Number.isInteger(recording.start_time)) {
            return {errormsg: `start_time should be an int for recording ${JSON.stringify(recording)}`};
        }

        if (recording.play_url) {
            if (typeof recording.play_url !== "string") {
                return {errormsg: `play_url should be a string for recording ${JSON.stringify(recording)}`};
            }
        } else {
            recording.play_url = "in_process";
        }
    }

    return {
        meeting_id: request.meeting_id,
        recordings: request.recordings
    };
}

function buildInsertMeetingRecordingsQuery(request) {
    let values = [];

    let sql = "INSERT IGNORE INTO MeetingRecording (MeetingID, RecordingTime, PlayURL) VALUES ";

    for (let recording of request.recordings) {
        sql += "(?, ?, ?),";
        values.push(request.meeting_id, recording.start_time, recording.play_url);
    }

    sql = sql.slice(0, -1); // remove last comma

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildInsertMeetingRecordingsQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function insertMeetingRecordingsSuccess(response) {
    return buildResponse(0, 200,
        log("insetMeetingRecordingsSuccess", "Response",
            `Inserted meeting recordings, response: ${JSON.stringify(response)}`), response);
}


//=============================================================================================

//=============================================================================================
//UpdateMeetingRecording
//check meeting id, check recording.play_url, check recording.start_time, return meeting_id and recording
function parseUpdateMeetingRecordingRequest(request) {
    if (!request.meeting_id) {
        return {errormsg: `Missing meeting_id`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting id should be an int`};
    }

    if (!request.recording) {
        return {errormsg: `Missing recording`};
    }

    if (!request.recording.play_url) {
        return {errormsg: `Missing recording.play_url`};
    } else if (typeof request.recording.play_url !== "string") {
        return {errormsg: `recording.play_url should be a string`};
    }

    if (!request.recording.start_time) {
        return {errormsg: `Missing recording.start_time`};
    } else if (!Number.isInteger(request.recording.start_time)) {
        return {errormsg: `recording.start_time should be an int`};
    }

    return {
        meeting_id: request.meeting_id,
        recording: request.recording
    };
}

function buildUpdateMeetingRecordingQuery(params) {
    let values = [params.recording.play_url, params.meeting_id, params.recording.start_time];
    let sql = "UPDATE `Data-1`.`MeetingRecording`" +
        "SET PlayURL = ?" +
        "WHERE MeetingID = ? AND RecordingTime = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildUpdateMeetingRecordingQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function updateMeetingRecordingSuccess(response) {
    return buildResponse(0, 200,
        log("deleteMeetingSuccess", "Response", `Successfully updated recording, response: ${JSON.stringify(response)}`));
}


//++++++++++++++++++++++++++++++++++++++++++++++++++++GROUP Queries++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

//=============================================================================================
//GetUserGroups

function parseGetUserGroupsRequest(request) {
    if (!request.email) {
        return {errormsg: `Missing user email`};
    }

    if (typeof request.email !== "string") {
        return {errormsg: `Email should be a string`};
    }

    return {
        email: request.email
    };
}

function buildGetUserGroupsQuery(params) {
    let values = [params.email];

    let sql = "SELECT JSON_OBJECT('group-name', g.Name, 'group_id', g.ID, 'is_favorite', g.IsFavorite, " +
        "'members', (SELECT JSON_ARRAYAGG(JSON_OBJECT " +
        "('email', u.email, 'name', concat(FName, ' ', LName), " +
        "'current_meeting', Topic, 'is_online', IsOnline, 'status', Status)) as members " +
        "FROM `Data-1`.`GroupMember` gm " +
        "INNER JOIN `Data-1`.`User` u ON u.email = gm.useremail " +
        "INNER JOIN `Data-1`.`UserStatus` us ON u.email = us.email " +
        "INNER JOIN `Data-1`.`UserLocation` ul ON u.email = ul.email " +
        "WHERE gm.ID = g.ID))  as 'Group'" +
        "FROM `Data-1`.`GroupOwner` go " +
        "INNER JOIN `Data-1`.`Group` g ON g.ID = go.GroupID " +
        "WHERE go.OwnerEmail LIKE ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetUserGroupsQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getUserGroupsSuccess(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getUserGroupsSuccess", "checking results",
                `Error querying for user groups, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0]) {
        return buildResponse(1, 404,
            warn("getUserGroupsSuccess", "checking results length",
                `No results found for specified user ID, query response: ${JSON.stringify(response.results)} `));
    }

    return buildResponse(0, 200,
        log("getUserGroupsSuccess", "Response", `Found groups for user, response: ${JSON.stringify(response.results)}`),
        response.results);
}

//=============================================================================================


//=============================================================================================
//CreateGroup


function parseCreateGroupRequest(request) {
    if (!request.group_name) {
        return {errormsg: `Missing group name`};
    } else if (typeof request.group_name !== "string") {
        return {errormsg: `group name should be of type string`};
    }

    return {
        group_name: request.group_name
    };
}

function buildCreateGroupQuery(params) {
    let values = [params.group_name];
    let sql = "INSERT INTO `Data-1`.`Group` (`Name`) VALUES (?)";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildCreateGroupQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function createGroupSuccess(response) {
    return buildResponse(0, 200,
        log("createGroupSuccess", "Response", `'Created group, response: ${JSON.stringify(response)}`),
        {ID: response.results.insertId});
}

//=============================================================================================

//=============================================================================================
//InsertGroupOwner


function parseInsertGroupOwnerRequest(request) {
    if (!request.email) {
        return {errormsg: `Missing email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `email should be of type string`};
    }

    if (!request.group_id) {
        return {errormsg: `Missing group ID`};
    } else if (typeof request.group_id !== "number") {
        return {errormsg: `group ID should be of type number`};
    }

    return {
        email: request.email,
        group_id: request.group_id
    };
}

function buildInsertGroupOwnerQuery(params) {
    let values = [params.email, params.group_id];
    let sql = "INSERT INTO `Data-1`.`GroupOwner` (`OwnerEmail`, `GroupID`) VALUES (?, ?)";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildCreateGroupQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function insertGroupOwnerSuccess(response) {
    return buildResponse(0, 200,
        log("insertGroupOwnerSuccess", "Response", `'Inserted group owner'`));
}

//=============================================================================================

//++++++++++++++++++++++++++++++++++++++++++++++++++++GROUP{ID} Queries+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//=============================================================================================
//AddUsersToGroup

function parseAddUsersToGroupRequest(request) {
    if (!request.group_id) {
        return {errormsg: `Missing group_id`};
    }

    if (!Number.isInteger(request.group_id)) {
        return {errormsg: `Group ID should be an integer`};
    }

    if (!request.users) {
        return {errormsg: `Missing list of users to add`};
    }

    if (!Object.prototype.toString.call(request.users) === '[object Array]') {
        return {errormsg: `users should be an array`};
    }

    if (request.users.length === 0) {
        return {errormsg: `Users list cannot be empty`};
    }

    for (let user of request.users) {
        if (!user.email) {
            return {errormsg: `Missing user email object for user ${JSON.stringify(user)}`};
        }
        if (typeof user.email !== "string") {
            return {errormsg: `user email should be a string`};
        }
    }

    return {
        group_id: request.group_id,
        users: request.users
    };
}

function buildAddUsersToGroupQuery(params) {
    let values = [];
    let sql = "INSERT IGNORE INTO `Data-1`.`GroupMember` (`ID`, `UserEmail`) VALUES ";

    if (params.users.length > 1) {
        for (let i = 0; i < params.users.length - 1; i++) {
            values.push(params["group_id"]);
            values.push(params.users[i].email);
            sql += "(?, ?), ";
        }
    }

    values.push(params["group_id"]);
    values.push(params.users[params.users.length - 1].email);
    sql += "(?, ?)";


    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildAddUsersToGroupQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function addUsersToGroupSuccess(response) {
    return buildResponse(0, 200,
        log("addUsersToGroupSuccess", "Response", `'successfully added user(s) to group'`));
}

//=============================================================================================

//=============================================================================================
//Delete Members From Group

function parseDeleteMembersFromGroupRequest(request) {
    if (!request.group_id) {
        return {errormsg: `Missing group_id`};
    }

    if (!Number.isInteger(request.group_id)) {
        return {errormsg: `Group ID should be an integer`};
    }

    if (!request.users) {
        return {errormsg: `Missing list of users to add`};
    }

    if (!Object.prototype.toString.call(request.users) === '[object Array]') {
        return {errormsg: `users should be an array`};
    }

    if (request.users.length === 0) {
        return {errormsg: `Users list cannot be empty`};
    }

    for (let user of request.users) {
        if (!user.email) {
            return {errormsg: `Missing user email object for user ${JSON.stringify(user)}`};
        }
        if (typeof user.email !== "string") {
            return {errormsg: `user email should be a string`};
        }
    }

    return {
        group_id: request.group_id,
        users: request.users
    };
}

function buildDeleteMembersFromGroupQuery(params) {
    let values = [];
    let sql = "DELETE FROM `Data-1`.`GroupMember` WHERE ID = ? AND ( UserEmail = ? ";

    values.push(params.group_id);
    values.push(params.users[0].email);

    if (params.users.length > 1) {
        for (let i = 1; i < params.users.length; i++) {
            sql += "OR UserEmail = ? ";
            values.push(params.users[i].email);
        }
    }

    sql += " )";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildDeleteMembersFromGroupQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function deleteMembersFromGroupSuccess(response) {
    return buildResponse(0, 200,
        log("deleteMembersFromGroupSuccess", "Response", `'Successfully removed user from group'`));
}

//=============================================================================================

//=============================================================================================
//Get Group
function parseGetGroupRequest(request) {
    if (!request.group_id) {
        return {errormsg: `Missing group_id`};
    }

    if (!Number.isInteger(request.group_id)) {
        return {errormsg: `group_id should be an integer`};
    }

    return {
        group_id: request.group_id,
    };
}

function buildGetGroupQuery(params) {
    let values = [params.group_id];
    let sql = "SELECT (JSON_OBJECT('group_id', g.ID, 'is_favorite', g.IsFavorite, 'group_name', g.Name, " +
        "'members', JSON_ARRAYAGG(JSON_OBJECT" +
        "('email', u.Email, 'name', CONCAT(u.FName,' ', u.LName), 'current_meeting', Topic, 'is_online', us.IsOnline, 'status', us.Status)))) as 'Group'" +
        " FROM `Data-1`.`Group` g " +
        "LEFT JOIN `Data-1`.`GroupMember` gm on g.ID = gm.ID " +
        "LEFT JOIN `Data-1`.`User` u on gm.UserEmail = u.Email " +
        "LEFT JOIN `Data-1`.`UserStatus` us on u.email = us.Email " +
        "LEFT JOIN `Data-1`.`UserLocation` ul on u.email = ul.Email " +
        "WHERE g.ID = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetGroupQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getGroupSuccess(response) {
    let parsedResponse = {};
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getGroupSuccess", "checking results",
                `Error querying for user group, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0] || !response.results[0].Group) {
        return buildResponse(1, 404,
            warn("getGroupSuccess", "checking results length",
                `No results found for specified group ID, query response: ${JSON.stringify(response.results)}`));
    }


    parsedResponse = JSON.parse(response.results[0].Group);

    if (!parsedResponse.group_id) {
        return buildResponse(1, 404,
            warn("getGroupSuccess", "checking results length",
                `No results found for specified group ID, query response: ${JSON.stringify(response.results)}`));
    }

    // if only 1 entry and it is null, the group is empty
    if (parsedResponse.members.length === 1 && !parsedResponse.members[0].email) {
        parsedResponse.members = [];
    }

    return buildResponse(0, 200,
        log("getGroupSuccess", "Response", `Found group, response: ${JSON.stringify(parsedResponse)}`), parsedResponse);
}

//=============================================================================================


//++++++++++++++++++++++++++++++++++++++++++++++++++++USERS Queries+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

//=============================================================================================
//Get User

function parseGetUserRequest(request) {
    if (!request.email) {
        return {errormsg: `Missing email`};
    }

    if (typeof request.email !== "string") {
        return {errormsg: `email should be a string`};
    }

    return {
        email: request.email
    };
}

function buildGetUserQuery(request) {
    let values = [request.email];

    let sql = "SELECT * FROM `Data-1`.`User` WHERE Email = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetUserQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getUserSuccess(response) {
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getUserSuccess", "checking results",
                `Error Querying for users, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0] || !response.results[0].Email) {
        return buildResponse(1, 404,
            warn("getUserSuccess", "checking results length",
                `No results found for specified user, query response: ${JSON.stringify(response.results)}`));
    }


    return buildResponse(0, 200,
        log("getUser", "Response", `Retrieved User, response: ${JSON.stringify(response.results[0])}`),
        response.results[0]);
}

//=============================================================================================

//=============================================================================================
//Get Users

function buildGetUsersQuery(params = {}) {
    let values = [];
    let sql = "SELECT JSON_ARRAYAGG(JSON_OBJECT('email', Email, 'name', concat(FName, ' ', LName))) AS Users " +
        "FROM (SELECT Email, FName, LName, ROW_NUMBER() OVER (ORDER BY FName ASC) " +
        "FROM `Data-1`.`User`) x"; // x is necessary because subqueries must be named, it's not actually used


    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetUsersQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getUsersSuccess(response) {

    let parsedResponse = {};
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getUsersSuccess", "checking results",
                `Error querying for users, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0] || !response.results[0].Users) {
        return buildResponse(1, 404,
            warn("getUsersSuccess", "checking results length",
                `No results found while querying for users, query response: ${JSON.stringify(response.results)}`));
    }


    parsedResponse = JSON.parse(response.results[0].Users);


    // if only 1 entry and it is null, the group is empty
    if (parsedResponse.length === 1 && !parsedResponse[0].email) {
        parsedResponse = [];
    }

    parsedResponse = {members: parsedResponse};

    return buildResponse(0, 200,
        log("getUsersSuccess", "Response", `Retrieved Users, response: ${JSON.stringify(parsedResponse)}`),
        parsedResponse);
}

//=============================================================================================

//=============================================================================================
//Get User Status

function parseGetUserStatusRequest(request) {
    if (!request.email) {
        return {errormsg: `Missing email`};
    }

    if (typeof request.email !== "string") {
        return {errormsg: `email should be a string`};
    }

    return {
        email: request.email
    };
}

function buildGetUserStatusQuery(params) {
    let values = [params.email];
    let sql = "SELECT JSON_OBJECT('email', u.Email, 'name', concat(FName, ' ', LName), " +
        "'is_online', IsOnline, 'status', us.Status, 'current_meeting', Topic, " +
        "'online_timestamp', OnlineTimestamp, 'meeting_loc_timestamp', MeetingLocationTimestamp) as User " +
        "FROM `Data-1`.`User` AS u " +
        "INNER JOIN `Data-1`.`UserStatus` AS us ON u.Email = us.Email " +
        "LEFT JOIN `Data-1`.`UserLocation` AS ul ON u.Email = ul.Email " +
        "WHERE u.email = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildGetUserStatusQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function getUserStatusSuccess(response) {

    let parsedResponse = {};
    if (!response || !response.results) {
        return buildResponse(1, 500,
            warn("getUserStatusSuccess", "checking results",
                `Error querying for user status, query response: ${JSON.stringify(response)}`));
    }
    if (response.results.length === 0 || !response.results[0] || !response.results[0].User) {
        return buildResponse(1, 404,
            warn("getUserStatusSuccess", "checking results length",
                `No results found for specified user, query response: ${JSON.stringify(response.results)}`));
    }

    parsedResponse = JSON.parse(response.results[0].User);

    if (!parsedResponse.email) {
        return buildResponse(1, 404,
            `No results found while querying user, query response: ${JSON.stringify(response.results)} `);
    }

    return buildResponse(0, 200,
        log("getUserstatusSuccess", "Response", `Retrieved User status, response: ${JSON.stringify(parsedResponse)}`),
        parsedResponse);
}

//=============================================================================================


//Update Participant
//=============================================================================================

function parseUpdateUserLocationRequest(request) {
    if (!request.meeting_id && request.meeting_id !== 0) {
        return {errormsg: `Missing meeting ID`};
    } else if (!Number.isInteger(request.meeting_id)) {
        return {errormsg: `Meeting ID should be a 64bit integer`};
    }

    if (!request.email) {
        return {errormsg: `Missing email email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `email should be a string`};
    }

    if (request.timestamp) {
        if (!Number.isInteger(request.timestamp)) {
            return {errormsg: `If timestamp is included, it should be an int`};
        }
    }

    return {
        email: request.email,
        meeting_id: request.meeting_id,
        timestamp: request.timestamp || Date.now()
    };
}

function buildUpdateUserLocationQuery(params) {

    let values = [];
    let sql = "UPDATE `Data-1`.`UserStatus` ";
    if (!params.meeting_id) {
        sql += "SET MeetingLocation = null, ";
    } else {
        values.push(params.meeting_id);
        sql += "SET MeetingLocation = ?, ";
    }

    sql += "MeetingLocationTimestamp = ? " +
        "WHERE Email = ?";

    values.push(params.timestamp, params.email);

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildUpdateUserLocationQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function updateUserLocationSuccess(response) {
    return buildResponse(0, 200,
        log("UpdateUserLocationSuccess", "Response", `Updated User Location, response: ${JSON.stringify(response.results)}`), response.results);
}

//=============================================================================================
//Update User Name

function parseUpdateUserNameRequest(request) {
    if (!request.email) {
        return {errormsg: `Missing email`};
    }

    if (typeof request.email !== "string") {
        return {errormsg: `email should be a string`};
    }

    if (!request.first_name) {
        return {errormsg: `Missing first_name`};
    }

    if (typeof request.first_name !== "string") {
        return {errormsg: `first_name should be a string`};
    }

    if (!request.last_name) {
        return {errormsg: `Missing last_name`};
    }

    if (typeof request.last_name !== "string") {
        return {errormsg: `last_name should be a string`};
    }

    return {
        email: request.email,
        first_name: request.first_name,
        last_name: request.last_name
    };
}

function buildUpdateUserNameQuery(params) {
    let values = [
        params.first_name,
        params.last_name,
        params.email
    ];

    let sql = "UPDATE `Data-1`.`User` " +
        "SET " +
        "`FName` = ?, " +
        "`LName` = ? " +
        "WHERE Email = ?";


    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildUpdateUserNameQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function updateUserNameSuccess(response) {
    return buildResponse(0, 200,
        log("updateUserNameSuccess", "Response", `'successfully updated user name'`));
}

function parseUpdateUserOnlineStatus(request) {
    if (!request.email) {
        return {errormsg: `Missing email email`};
    } else if (typeof request.email !== "string") {
        return {errormsg: `email should be a string`};
    }

    if (request.is_online === null) {
        return {errormsg: `is_online missing`};
    } else if (request.is_online !== true && request.is_online !== false) {
        return {errormsg: `is_online should either be true or false`};
    }

    if (request.timestamp) {
        if (!Number.isInteger(request.timestamp)) {
            return {errormsg: `If timestamp is included, it should be an int`};
        }
    }

    return {
        email: request.email,
        is_online: request.is_online,
        timestamp: request.timestamp || Date.now()
    };
}

function buildUpdateUserOnlineStatusQuery(params) {

    let values = [params.is_online, params.timestamp, params.email];
    let sql = "UPDATE `Data-1`.`UserStatus` " +
        "SET IsOnline = ?, " +
        "OnlineTimestamp = ? " +
        "WHERE Email = ?";

    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };

    log("buildUpdateUserOnlineStatusQuery", "After Query", `Query: ${JSON.stringify(query)}`);

    return query;
}

function updateUserOnlineStatusSuccess(response) {
    return buildResponse(0, 200,
        log("updateUserOnlineStatusSuccess", "Response", `Updated User Online Status, response: ${JSON.stringify(response.results)}`), response.results);
}

//=============================================================================================

exports.handler = async (event, context) => {

    try {
        requestID = context.awsRequestId;
        useremail = event.headers.user || "unknown";
        log("main", "before checks", `received event: ${JSON.stringify(event)}`);

        if (!event.headers) {
            return buildResponse(2, 400,
                warn("main", "event.headers", `Missing headers, query: ${JSON.stringify(event)}`));
        }

        if (!event.headers.access_token || !event.headers.refresh_token) {
            return buildResponse(2, 401,
                warn("main", "event.headers.tokens", `Missing tokens, access denied, query: ${JSON.stringify(event)}`));
        }

        if (!event.body) {
            return buildResponse(2, 400,
                warn("main", "event.body", `Missing body, query: ${JSON.stringify(event)}`));
        }

        if (!event.functionName) {
            return buildResponse(4, 400,
                warn("main", "event.fuctionName", `Missing function name, query: ${JSON.stringify(event)}`));
        }

        log("Main", "Before Switch Statement", `event.functionName : ${JSON.stringify(event.functionName)}`);

        switch (event.functionName) {
            case FunctionName.CREATE_MEETING:
                return await performQuery("Create Meeting", event.body,
                    parseCreateMeetingRequest, buildCreateMeetingQuery, createMeetingSuccess);

            case FunctionName.UPDATE_MEETING_STATUS:
                return await performQuery("Update Meeting Status", event.body,
                    parseUpdateMeetingStatusRequest, buildUpdateMeetingStatusQuery, updateMeetingStatusSuccess);

            case FunctionName.EDIT_MEETING:
                return await performQuery("Edit Meeting", event.body,
                    parseEditMeetingRequest, buildEditMeetingQuery, editMeetingSuccess);

            case FunctionName.DELETE_MEETING:
                return await performQuery("Delete Meeting", event.body,
                    parseDeleteMeetingRequest, buildDeleteMeetingQuery, deleteMeetingSuccess);

            case FunctionName.GET_MEETING:
                return await performQuery("Get Meeting", event.body,
                    parseGetMeetingRequest, buildGetMeetingQuery, getMeetingSuccess);

            case FunctionName.GET_MEETING_DETAILS:
                return await performQuery("Get Meeting With Details", event.body,
                    parseGetMeetingDetailsRequest, buildGetMeetingDetailsQuery, getMeetingDetailsSuccess);

            case FunctionName.GET_CURRENT_MEETINGS:
                return await performQuery("Get Current Meetings", event.body,
                    parseGetCurrentMeetingsRequest, buildGetCurrentMeetingsQuery, getCurrentMeetingsSuccess);

            case FunctionName.GET_ONGOING_MEETINGS:
                return await performQuery("Get Ongoing Meetings", event.body,
                    parseGetOngoingMeetingsRequest, buildGetOngoingMeetingsQuery, getOngoingMeetingsSuccess);

            case FunctionName.GET_UPCOMING_MEETINGS:
                return await performQuery("Get Upcoming Meetings", event.body,
                    parseGetUpcomingMeetingsRequest, buildGetUpcomingMeetingsQuery, getUpcomingMeetingsSuccess);

            case FunctionName.INSERT_MEETING_RECORDINGS:
                return await performQuery("Insert Meeting Recordings", event.body,
                    parseInsertMeetingRecordingsRequest, buildInsertMeetingRecordingsQuery, insertMeetingRecordingsSuccess);
            case FunctionName.UPDATE_MEETING_RECORDING:
                return await performQuery("Update Meeting Recording", event.body,
                    parseUpdateMeetingRecordingRequest, buildUpdateMeetingRecordingQuery, updateMeetingRecordingSuccess);

            case FunctionName.GET_PARTICIPANT:
                return await performQuery("Get Participant", event.body,
                    parseGetParticipantRequest, buildGetParticipantQuery, getParticipantSuccess);

            case FunctionName.ADD_PARTICIPANT:
                return await performQuery("Add Participant", event.body,
                    parseAddParticipantRequest, buildAddParticipantQuery, addParticipantSuccess);

            case FunctionName.ADD_PARTICIPANTS:
                return await performQuery("Add Participants", event.body,
                    parseAddParticipantsRequest, buildAddParticipantsQuery, addParticipantsSuccess);

            case FunctionName.UPDATE_PARTICIPANT:
                return await performQuery("Update Participants", event.body,
                    parseUpdateParticipantRequest, buildUpdateParticipantQuery, updateParticipantSuccess);

            case FunctionName.UPDATE_ALL_MEETING_PARTICIPANTS:
                return await performQuery("Update All Meeting Participants", event.body,
                    parseUpdateAllMeetingParticipantsRequest, buildUpdateAllMeetingParticipantsQuery, updateAllMeetingParticipantsSuccess);

            case FunctionName.UPDATE_ALL_USER_STATUS_FOR_MEETING:
                return await performQuery("Update All User Status For Meeting", event.body,
                    parseUpdateAllUserStatusForMeetingRequest, buildUpdateAllUserStatusForMeetingQuery, updateAllUserStatusForMeetingSuccess);

            case FunctionName.GET_GROUP:
                return await performQuery("Get Group", event.body,
                    parseGetGroupRequest, buildGetGroupQuery, getGroupSuccess);

            case FunctionName.CREATE_GROUP:
                return await performQuery("Create Group", event.body,
                    parseCreateGroupRequest, buildCreateGroupQuery, createGroupSuccess);

            case FunctionName.INSERT_GROUP_OWNER:
                return await performQuery("Insert Group Owner", event.body,
                    parseInsertGroupOwnerRequest, buildInsertGroupOwnerQuery, insertGroupOwnerSuccess);

            case FunctionName.ADD_USERS_TO_GROUP:
                return await performQuery("Add Users To Group", event.body,
                    parseAddUsersToGroupRequest, buildAddUsersToGroupQuery, addUsersToGroupSuccess);

            case FunctionName.DELETE_USERS_FROM_GROUP:
                return await performQuery("Remove users From Group", event.body,
                    parseDeleteMembersFromGroupRequest, buildDeleteMembersFromGroupQuery, deleteMembersFromGroupSuccess);

            case FunctionName.GET_USER_GROUPS:
                return await performQuery("Get User Groups", event.body,
                    parseGetUserGroupsRequest, buildGetUserGroupsQuery, getUserGroupsSuccess);

            case FunctionName.GET_USER:
                return await performQuery("Get User", event.body,
                    parseGetUserRequest, buildGetUserQuery, getUserSuccess);

            case FunctionName.GET_USERS:
                return await performQuery("Get Users", event.body,
                    () => {
                        return {};
                    }, buildGetUsersQuery, getUsersSuccess);

            case FunctionName.GET_USER_STATUS:
                return await performQuery("Get User Status", event.body,
                    parseGetUserStatusRequest, buildGetUserStatusQuery, getUserStatusSuccess);

            case FunctionName.UPDATE_USER_LOCATION:
                return await performQuery("Update User Location", event.body,
                    parseUpdateUserLocationRequest, buildUpdateUserLocationQuery, updateUserLocationSuccess);

            case FunctionName.UPDATE_USER_NAME:
                return await performQuery("Update User Name", event.body,
                    parseUpdateUserNameRequest, buildUpdateUserNameQuery, updateUserNameSuccess);

            case FunctionName.UPDATE_USER_STATUS:
                return await performQuery("Update User Status", event.body,
                    parseUpdateUserOnlineStatus, buildUpdateUserOnlineStatusQuery, updateUserOnlineStatusSuccess);

            case FunctionName.GET_MEETING_PARTICIPANTS:
                return await performQuery("Get Meeting Participants", event.body,
                    parseGetMeetingParticipantsRequest, buildGetMeetingParticipantsQuery, getMeetingParticipantsSuccess);

            case FunctionName.GET_MEETING_PARTICIPANTS_FOR_EDIT_MEETING_RESPONSE:
                return await performQuery("Get Meeting Participants Joining Users and Others", event.body,
                    parseGetMeetingParticipantsForEditResponse, buildGetMeetingParticipantsForEditResponse, getMeetingParticipantsForEditResponse);

            case FunctionName.DELETE_MEETING_PARTICIPANTS:
                log("RDSAdapter", "Inside DELETE_MEETING_PARTICIPANTS Case", "works");
                return await performQuery("Delete Meeting Participants", event.body,
                    parseDeleteMeetingParticipantRequest, buildDeleteMeetingParticipantQuery, deleteMeetingParticipantSuccess);

            default:
                return INVALID_FCN_ERROR(event);
        }
    } catch (err) {
        return warn("main", "Caught Error", `Error: ${JSON.stringify(err.stack)}`);
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
    return `[[ RDSAdapter - ${funcname} ]] -> ${process}, user:${useremail}, id: ${requestID}
        logged -- ${log}`;
}