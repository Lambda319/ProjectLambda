# ProjectLambda

Welcome to Project Lambda, a Zoom web-app app where users can create, join, edit and delete Zoom meetings for their organization! 

Multiple views provide different ways to visualize meeting schedules and search for time ranges and/or colleagues. Users can also manage groups of frequently contacted colleagues, as well as start instant meetings with group members in one-click.

**Check out the deployed project [here](https://zoom-dashboard.tk)**. This works best on Chrome, and is not supported on mobile devices. 
Please note this deployment will no longer be hosted by January 2023.

The back-end is serverless, built using API Gateway and Lambda. All data is hosted in a micro RDS instance.

Screenshots & example videos to come.

## The following users have been configured with log in credentials:
- Adelaide Koloman (username: adelaidekoloman@zoom-dashboard.tk)
- Cassie Medrod (username: cassiemedrod@zoom-dashboard.tk)
- Sherali Nora (username: sheralinora@zoom-dashboard.tk)
- Liese Emili (username: lieseemili@zoom-dashboard.tk)
- Cornel Gurgen (username: cornelgurgen@zoom-dashboard.tk)
- Liam Marcel (username: liammarcel@zoom-dashboard.tk)

Authentication is through Zoom. Password for all users: nipGezvisfymxanre6.

To log in, make sure you are not signed into your own Zoom account on Zoom.us. 
After clicking login on the web-app, you may be prompted to add the application to the account above. Make sure you click 'Allow'.


## Supported Features
For full functionality, please have the zoom app installed locally. Please note, the features in the sertings page are currently disabled in the back-end
### Dashboard
- Updated in real-time using websockets
- Displays participants invited to meetings and participants that have joined meetings
- Can join ongoing meetings from the dasboard
- Search & sort through meetings

### Meeting Viewer & Calendar
- View past meetings, their participants, their scheduled date & time
- View meeting status (scheduled, in progress, ended)
- View participants status (invited, not invited but joined, attended)
- Edit or delete meetings that are scheduled (not in progress or ended)
- Start meetings or join ongoing meetings
- Search & sort through meetings
- Can elect to only view meetings of a subteam the user belongs in

### Favorites & Groups
- Updated in real-time using websockets
- Add or remove users from favorites or other groups
- Create, edit, or delete groups (other than favorites)
- View user status (offline, online, in meeting incl. meeting name)
- Search & sort through users
- Call all users on a list or call selected users (known as 'Call All', more details bellow)

### Other features

#### Create Meeting
- Meetings can be created from any view using the sidebar button

#### Call All
- Calls all users in a list / selected users 
- This creates a meeting, invites the selected users, and starts the meeting.
- Invited with the application open will receive a web notification and/or a desktop notification asking them to join the meetings.
- Clicking the notification will launch the meeting for them.


#### Notifications
- Notifications are delivered using the webapp, and optionally using desktop notifications if allowed by the user when prompted. Desktop notifications are not supported on firefox.
- Call all notifications (received instantly)
- Meeting reminders (30 and 15 minutes prior to a scheduled meeting)
- Meeting starting reminder (when a meeting starts).

#### Email notifications
- Emails are sent to users invited to a scheduled meeting who have not joined the meetings 2 minutes after it has started
- Notifications include a link to join the meeting
- This feature is deployed, but is currently not available for testing. Screenshots and test emails will be provided to preview this feature. 

#### Webhook Events
- Zoom webhooks are used to persist meetings created, deleted or updated externally into the database.
- Webhooks are also used to determine when meetings are started or have ended, or when participants join or leave meetings.
- Webhooks can also be used to determine whether a meeting was recorded in the cloud. While this is supported in our application, a Pro Zoom account is required for this feature to be enabled for new meetings
