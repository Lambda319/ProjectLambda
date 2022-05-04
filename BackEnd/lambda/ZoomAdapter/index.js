const rp = require("request-promise");

// ============= Constants/Generic Helpers ===============================
const api_prefix = "https://api.zoom.us/v2";
const auth_url = "https://zoom.us/oauth/token";
const redirect_url = "https://cpa6s5u7uh.execute-api.us-west-2.amazonaws.com/v1/auth";
const BAD_API_ERROR = {
    error: 3,
    msg: "Invalid API name",
};
const APIName = {
    CREATE_MEETING: "CREATE_MEETING",
    EDIT_MEETING: "EDIT_MEETING",
    DELETE_MEETING: "DELETE_MEETING",
    GET_MEETING: "GET_MEETING",
    GET_ACCESS_TOKEN: "GET_ACCESS_TOKEN",
    ME: "ME",
};

function MALFORMED_ERROR(err) {
    console.log(err);
    return {
        error: 4,
        msg: "ERROR: " + err,
    };
}

function handleResponseFailure(err) {
    console.log("Zoom threw an error: " + err);
    let error_msg = JSON.parse(err.error).message;

    const response = {
        error: 1,
        msg: "ZOOM ERROR: " + error_msg,
    };

    return response;
}

async function callZoomAPI(request, tokens, onSuccess, onFailure = handleResponseFailure) {
    request.headers["content-type"] = "application/json";
    let response;

    try {
        console.log("calling Zoom API");
        const resp = await rp(request);
        response = onSuccess(resp);
        // don't add token headers for getAccessToken call
        if (tokens !== null) {
            response.token = {
                updated: false,
                access: tokens.access_token,
                refresh: tokens.refresh_token
            };
        }

        console.log("successful Zoom response: " + JSON.stringify(response));
        return response;
    } catch (err) {
        // refresh tokens if Zoom's invalid access token error thrown
        if (err.statusCode === 401) {
            let error = JSON.parse(err.error);
            if (error.code === 124) {
                console.log("refreshing tokens and trying again");
                return await handleRefreshToken(request, tokens, onSuccess, onFailure);
            }
        }

        console.log("Zoom API call failed: " + err);
        return onFailure(err);
    }
}

//======================================================

// ============= Create Meeting ===============================
function checkCreateMeetingParams(body) {
    if (!body.topic) {
        return MALFORMED_ERROR("CREATE MEETING: meeting topic missing");
    } else if (typeof body.topic !== "string") {
        return MALFORMED_ERROR("CREATE MEETING: topic must be a string");
    }
    if (!body.startTime) {
        return MALFORMED_ERROR("CREATE MEETING: meeting start time missing");
    } else if (!Number.isInteger(body.startTime)) {
        return MALFORMED_ERROR("CREATE MEETING: start_time must be a number (millisecond epoch time)");
    }
    if (!body.endTime) {
        return MALFORMED_ERROR("CREATE MEETING: meeting end time missing");
    } else if (!Number.isInteger(body.endTime)) {
        return MALFORMED_ERROR("CREATE MEETING: end_time must be a number (millisecond epoch time)");
    }
    if (body.endTime <= body.startTime) {
        return MALFORMED_ERROR("CREATE MEETING: end time must be after start time");
    }
    if (!body.email) {
        return MALFORMED_ERROR("CREATE MEETING: user email missing");
    } else if (typeof body.email !== "string") {
        return MALFORMED_ERROR("CREATE MEETING: email must be a string");
    }

    return null;
}

function buildCreateMeetingRequest(args) {
    const token = args.token;
    const topic = args.topic;
    const start_time = args.startTime;
    const end_time = args.endTime;
    const email = args.email;

    let request = {
        method: "POST",
        url: `${api_prefix}/users/${email}/meetings`,
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            default_password: true,
            duration: Math.ceil((end_time - start_time) / 60000),
            pre_schedule: false,
            schedule_for: email,
            start_time: new Date(parseInt(start_time)).toISOString(),
            timezone: "UTC",
            topic: topic,
            type: 2,
        }),
    };

    console.log("create meeting request: " + JSON.stringify(request));
    return request;
}

function handleCreateMeetingResponse(apiResponse) {
    apiResponse = JSON.parse(apiResponse);

    let response = {
        error: 0,
        msg: "Meeting Created",
        body: JSON.stringify({
            meeting_id: apiResponse.id,
            url: apiResponse.join_url,
            password: apiResponse.password,
        }),
    };

    console.log("create meeting resoponse: " + JSON.stringify(response));
    return response;
}

//======================================================

//=================== Edit Meeting ===================================
function checkEditMeetingParams(body) {
    if (!body.meetingID) {
        return MALFORMED_ERROR("EDIT MEETING: meeting ID missing");
    } else if (!Number.isInteger(body.meetingID)) {
        return MALFORMED_ERROR("EDIT MEETING: meeting ID must be a 64 bit integer");
    }
    if (!body.topic) {
        return MALFORMED_ERROR("EDIT MEETING: meeting topic missing");
    } else if (typeof body.topic !== "string") {
        return MALFORMED_ERROR("EDIT MEETING: topic must be a string");
    }
    if (!body.startTime) {
        return MALFORMED_ERROR("EDIT MEETING: meeting start time missing");
    } else if (!Number.isInteger(body.startTime)) {
        return MALFORMED_ERROR("EDIT MEETING: start_time must be a number (millisecond epoch time)");
    }
    if (!body.endTime) {
        return MALFORMED_ERROR("EDIT MEETING: meeting end time missing");
    } else if (!Number.isInteger(body.endTime)) {
        return MALFORMED_ERROR("EDIT MEETING: end_time must be a number (millisecond epoch time)");
    }
    if (body.endTime <= body.startTime) {
        return MALFORMED_ERROR("EDIT MEETING: end time must be after start time");
    }
    if (!body.email) {
        return MALFORMED_ERROR("EDIT MEETING: user email missing");
    } else if (typeof body.email !== "string") {
        return MALFORMED_ERROR("EDIT MEETING: email must be a string");
    }
    return null;
}

function buildEditMeetingRequest(args) {
    let request = buildCreateMeetingRequest(args);
    request.method = "PATCH";
    request.url = `${api_prefix}/meetings/${args.meetingID}`;

    console.log("edit meeting request: " + JSON.stringify(request));
    return request;
}

function handleEditMeetingResponse(apiResponse) {
    const response = {
        error: 0,
        msg: "Meeting Edited",
        body: {},
    };

    console.log("edit meeting response: " + JSON.stringify(response));
    return response;
}

//======================================================

//=================== Delete Meeting ===================================
function checkDeleteMeetingParams(body) {
    if (!body.meetingId) {
        return MALFORMED_ERROR("DELETE MEETING: meeting ID missing");
    } else if (!Number.isInteger(body.meetingId)) {
        return MALFORMED_ERROR("DELETE MEETING: meeting ID must be a 64 bit integer");
    }

    return null;
}

function buildDeleteMeetingRequest(args) {
    const token = args.token;
    const meeting_id = args.meetingId;

    let request = {
        method: "DELETE",
        url: `${api_prefix}/meetings/${meeting_id}`,
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };

    console.log("delete meeting request: " + JSON.stringify(request));
    return request;
}

function handleDeleteMeetingResponse(apiResponse) {
    const response = {
        error: 0,
        msg: "Meeting Deleted",
        body: {},
    };

    console.log("delete meeting response: " + JSON.stringify(response));
    return response;
}

//======================================================

//=================== Get Meeting ===================================
function checkGetMeetingParams(body) {
    if (!body.meetingID) {
        return MALFORMED_ERROR("GET MEETING: meeting ID missing");
    } else if (!Number.isInteger(body.meetingID)) {
        return MALFORMED_ERROR("GET MEETING: meeting ID must be a 64 bit integer");
    }

    return null;
}

// for recurring meeting: occurence_ID for an occurence
// show_previous_occurences -> false for now
function buildGetMeetingRequest(args) {
    const token = args.token;
    let id = args.meetingID;

    const request = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        method: "GET",
        url: `${api_prefix}/meetings/${id}`,
    };

    console.log("get meeting request: " + JSON.stringify(request));
    return request;
}

function handleGetMeetingResponse(apiResponse) {
    apiResponse = JSON.parse(apiResponse);
    let startTime = new Date(apiResponse.start_time).getTime();

    let response = {
        error: 0,
        msg: "Meeting Retrieved",
        body: {
            id: apiResponse.id,
            start_time: startTime,
            end_time: startTime + apiResponse.duration * 60000,
            topic: apiResponse.topic,
            host: apiResponse.host_email,
            link: apiResponse.join_url,
            password: apiResponse.password,
            recorded: 0,
        },
    };

    console.log("get meeting response: " + JSON.stringify(response));
    return response;
}

//======================================================

//=================== Get Access Token ===================================
function checkGetAccessTokenParams(body) {
    if (!body.authToken) {
        return MALFORMED_ERROR("GET ACCESS TOKEN: auth token missing");
    } else if (typeof body.authToken !== "string") {
        return MALFORMED_ERROR("GET ACCESS TOKEN: auth token must be a string");
    }

    return null;
}

function buildGetAccessTokenRequest(args) {
    const authToken = args.authToken;
    const uri = args.redirectUri;
    const clientID = args.clientId;
    const clientSecret = args.clientSecret;

    const request = {
        method: "POST",
        url: auth_url,
        qs: {
            grant_type: "authorization_code",
            code: authToken,
            redirect_uri: uri,
        },
        headers: {
            Authorization:
                "Basic " + Buffer.from(
                    `${clientID}:${clientSecret}`
                ).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
    };

    console.log("get access token request: " + JSON.stringify(request));
    return request;
}

function handleGetAccessTokenResponse(apiResponse) {
    apiResponse = JSON.parse(apiResponse);

    const response = {
        error: 0,
        msg: "Retrieved Access Token",
        body: {
            accessToken: apiResponse.access_token,
            refreshToken: apiResponse.refresh_token,
        },
    };

    console.log("get access token response: " + JSON.stringify(response));
    return response;
}

//======================================================

//=================== Refresh Tokens ===================================
function buildRefreshTokenRequest(tokens) {
    const request = {
        method: "POST",
        url: auth_url,
        qs: {
            grant_type: "refresh_token",
            refresh_token: tokens.refresh_token,
        },
        headers: {
            Authorization: "Basic " + Buffer.from(
                `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
            ).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded"
        },
    };

    console.log("refresh token request: " + JSON.stringify(request));
    return request;
}

async function handleRefreshToken(request, tokens, onSuccess, onFailure) {
    let token_response, response, new_token;

    // ask Zoom for new access/refresh token pair
    try {
        const refreshedTokens = buildRefreshTokenRequest(tokens);
        token_response = await rp(refreshedTokens);
        new_token = {
            updated: true,
            access: JSON.parse(token_response).access_token,
            refresh: JSON.parse(token_response).refresh_token
        };
        console.log("tokens refreshed successfully");
    } catch (err) {
        let error_msg = JSON.parse(err.error).reason + " - Fetch of New Refresh/Access Token Failed";

        response = {
            error: 2,
            msg: error_msg,
            tokens: {
                updated: false,
                access: tokens.access_token,
                refresh: tokens.refresh_token
            },
        };

        console.log("token refresh failed: " + JSON.stringify(response));
        return response;
    }

    // Retry original API call with updated tokens
    try {
        request.headers = {
            Authorization: `Bearer ${JSON.parse(token_response).access_token}`,
            "Content-Type": "application/json"
        };
        console.log("retrying original API call");
        const resp = await rp(request);
        response = onSuccess(resp);
    } catch (err) {
        response = onFailure(err);
    }
    response.token = new_token;
    console.log("retried API call response: " + JSON.stringify(response));
    return response;
}

//======================================================

//=================== Me ===================================
function buildMeRequest(args) {
    const token = args.token;

    let request = {
        method: "GET",
        url: `${api_prefix}/users/me`,
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };

    console.log("me request: " + JSON.stringify(request));
    return request;
}

function handleMeResponse(apiResponse) {
    apiResponse = JSON.parse(apiResponse);

    let response = {
        error: 0,
        msg: "User Information Retrieved",
        body: JSON.stringify({
            email: apiResponse.email,
            first_name: apiResponse.first_name,
            last_name: apiResponse.last_name,
        }),
    };

    console.log("me response: " + JSON.stringify(response));
    return response;
}

//======================================================

//=================== "main" method ===================================
exports.handler = async (event) => {

    // check for tokens
    if (event.name === APIName.CREATE_MEETING ||
        event.name === APIName.EDIT_MEETING ||
        event.name === APIName.DELETE_MEETING ||
        event.name === APIName.GET_MEETING ||
        event.name === APIName.ME) {
        if (!event.body.token) {
            return MALFORMED_ERROR("access token missing");
        }
        if (!event.body.refresh_token) {
            return MALFORMED_ERROR("refresh token missing");
        }
    }

    let request, paramCheckErrors;
    let tokens = {
        access_token: event.body.token,
        refresh_token: event.body.refresh_token,
    };

    switch (event.name) {
        case APIName.CREATE_MEETING:
            console.log("creating a meeting...");
            paramCheckErrors = checkCreateMeetingParams(event.body);
            if (paramCheckErrors !== null) {
                return paramCheckErrors;
            }
            request = buildCreateMeetingRequest(event.body);
            return await callZoomAPI(request, tokens, handleCreateMeetingResponse);

        case APIName.EDIT_MEETING:
            console.log("editing a meeting...");
            paramCheckErrors = checkEditMeetingParams(event.body);
            if (paramCheckErrors !== null) {
                return paramCheckErrors;
            }
            request = buildEditMeetingRequest(event.body);
            return await callZoomAPI(request, tokens, handleEditMeetingResponse);

        case APIName.DELETE_MEETING:
            console.log("deleting a meeting...");
            paramCheckErrors = checkDeleteMeetingParams(event.body);
            if (paramCheckErrors !== null) {
                return paramCheckErrors;
            }
            request = buildDeleteMeetingRequest(event.body);
            return await callZoomAPI(request, tokens, handleDeleteMeetingResponse);

        case APIName.GET_MEETING:
            console.log("getting a meeting...");
            paramCheckErrors = checkGetMeetingParams(event.body);
            if (paramCheckErrors !== null) {
                return paramCheckErrors;
            }
            request = buildGetMeetingRequest(event.body);
            return await callZoomAPI(request, tokens, handleGetMeetingResponse);

        case APIName.GET_ACCESS_TOKEN:
            console.log("getting access tokens...");
            paramCheckErrors = checkGetAccessTokenParams(event.body);
            if (paramCheckErrors !== null) {
                return paramCheckErrors;
            }
            request = buildGetAccessTokenRequest(event.body);
            return await callZoomAPI(request, null, handleGetAccessTokenResponse);

        case APIName.ME:
            console.log("getting my name and email...");
            request = buildMeRequest(event.body);
            return await callZoomAPI(request, tokens, handleMeResponse);

        default:
            console.log("bad API name: " + event.name);
            return BAD_API_ERROR;
    }
};
