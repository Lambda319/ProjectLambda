# Includes:

- meeting start/end notifications
- user joined/left notifications
- call all notifications
- 15/30 min and now meeting notifications
- new/updated/deleted meeting notifications
- log in/out notifications
- meeting recording notifications

## Input (from calling lambda):
```
event =  {
    name: "",
    body: <defined below>
}
```

## Response (to calling lambda):
```
{
  statusCode: 200 || 500,
  body: {
      response: {} // contains response from AWS if any
  }
}
```

## Input (from front end):
```
{
  action: "LOG_IN",
  data: <user email address>
}
```

## Output (to front end):
Response bodies will have additional fields for internal log tracing purposes. Please do not render them!
```
{
event: <one of the below events>,
body: <corresponding body below>
} 
```

### `LOG_IN` body
```
{
  email: ""
}
```

### `LOG_OUT` body
```
{
  email: ""
}
```

### `MEETING_START` body

```
{
id: number,
title: "",
organizer_email: "",
organizer_name: "",
start_time: number,
end_time: number,
download_link: null,
join_url: "",
password: "",
status: 1,
participants: [{
                name: "",
                email: "",
                attended: false,
                is_in_meeting: false,
                is_online: boolean,
                was_invited: true
              }, ...]
}
```

### `MEETING_END` body

```
{
meeting_id: number
}
```

### `USER_JOINED` body

```
{
meeting_id: number,
title: "",
email: "", 
name: ""
}
```
### `USER_LEFT` body

```
{
meeting_id: number,
email: "" 
}
```

### `CALL_ALL` body
```
{
host: "",
host_email: "",
meeting_id: number,
title: "",
start_time: number,
join_url: "",
password: "",
participants: [{"email": ""}, ...]
}
```

### `NOTIFY_15` body
```
{
meeting_id: number,
start_time: number,
title: "",
join_url: "",
password: "",
participants: [{"email": ""}, ...]
}
```

### `NOTIFY_30` body
```
{
meeting_id: number,
start_time: number,
title: "",
join_url: "",
password: "",
participants: [{"email": ""}, ...]
}
```

### `NOTIFY_NOW` body
```
{
meeting_id: number,
title: "",
join_url: "",
password: "",
participants: [{"email": ""}, ...]
}
```

### `NEW_MEETING` body

```
{
id: number,
title: "",
organizer_email: "",
organizer_name: "",
start_time: number,
end_time: number,
download_link: null,
join_url: "",
password: "",
status: 0,
participants: [{
                name: "",
                email: "",
                attended: false,
                is_in_meeting: false,
                is_online: boolean,
                was_invited: true
              }, ...]
}
```

### `UPDATED_MEETING` body

```
{
id: number,
title: "",
organizer_email: "",
organizer_name: "",
start_time: number,
end_time: number,
download_link: null,
join_url: "",
password: "",
status: 0,
participants: [{
                name: "",
                email: "",
                attended: false,
                is_in_meeting: false,
                is_online: boolean,
                was_invited: true
              }, ...]
}
```

### `DELETED_MEETING` body

```
{
id: number
}
```