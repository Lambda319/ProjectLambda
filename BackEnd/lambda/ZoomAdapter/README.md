## Includes:

- Create/Get/Edit/Delete meeting (APIName. "CREATE_MEETING / "GET_MEETING" / "EDIT_MEETING" / "DELETE_MEETING")
- Login (get access token + refresh token) (APIName."GET_ACCESS_TOKEN")
- Refresh (get new access token) (On access token error)

### Response codes:

- 0: Success
- 1: API error
- 2: Fatal error (Session expired, login again)
- 3: Invalid API request

### Input:

```
event =  {
    APIName: "",
    body: {
        token: "",
        refresh_token:"",
        <args...>
    }
}
```

### Response (success)

```
response = {
    error: 0,
    msg: "",
   token: {
        updated: false, //(or true)
        access: "",
        refresh: "",
    },
   body: {
    <data>
    }
}
```

### Response (GET_ACCESS_TOKEN success)

```
response = {
    error: 0,
     msg: "Retrieved Access Token",
     body: {
          accessToken: "",
          refreshToken: "",
     },
}
```

### Response (Failure)

```
response = {
    error: 1, // or 2 or 3
    msg: "error msg",
   token: {
        updated: false, //(or true)
        access: "",
        refresh: "",
    },
   body: {}
}
```

## Other notes

### Parsing errors from zoom:

```
    const code = err.statusCode;
    const error = JSON.parse(err.error);
    const errorCode = error.code;
    const message = error.message;
```

### Create Meeting Errors

#### HTTP 300:

- Invalid enforce_login_domains, separate multiple domains by semicolon. A maximum of x meetings can be created/updated
  for a single user in one day

#### HTTP 400:

- 3000: Instant meetings do not support the schedule_for parameter;
- you cannot schedule an instant meeting for another user.
- Users in '{0}' have been blocked from joining meetings and webinars. To unblock them, go to the Settings page in the
  Zoom web portal and update 'Block users in specific domains from joining meetings and webinars'.
- You cannot schedule a meeting for {0}.

#### HTTP 404:

- 1001: User x not exist or not belong to this account.

### Get Meeting Errors

#### HTTP 400:

- 1010 : User not found on this account : {accountId}
- 3000 : Cannot access Webinar
- 3161 : Meeting hosting and scheduling capabilities are not allowed for your user account.

#### HTTP 404:

- 1001 : User not exist : {userid}
- 3001 : Meeting {meetingId} is not found or has expired.

### Edit meeting errors

##### HTTP 400

- 1010 user not found
- 3000 cannot access meeting
- 3003 not meeting host
- 3000 instant meetings do not support schedule_for
- 3161 meeting hosting/schedule not allowed for this account

##### HTTP 404:

- 404 meeting not found
- 1001 user DNE
- 3001 meeting DNE/Expired

### Delete meeting errors

#### HTTP 400:

- 1010: User does not belong to this account
- 3000: Cannot access meeting information. Invalid occurrence_id
- 3002: Sorry, you cannot delete this meeting since it is in progress
- 3003: You are not the meeting host
- 3007: Sorry, you cannot delete this meeting since it has ended
- 3018: Not allowed to delete PMI
- 3037: Not allowed to delete PAC
- 3161: Meeting hosting and scheduling capabilities are not allowed for your user account

#### HTTP 404:

- 1001: User does not exist
- 3001: Meeting with this {meetingId} is not found or has expired
