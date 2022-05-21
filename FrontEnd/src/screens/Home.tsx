import React, { useEffect } from "react";
import { useState } from "react";
import { useSelector } from "react-redux";
import LoadingSpinner from "components/LoadingSpinner";
import Dashboard from "./Dashboard";
import Favourites from "./Favourites";
import "antd/dist/antd.min.css";
import Sidebar from "../components/Sidebar";
import { Button, Layout, notification } from "antd";
import NewMeeting from "components/NewMeeting";
import { getCookieValue, updateCookies } from "common";
import axios from "axios";
import { useDispatch } from "react-redux";
import { PhoneTwoTone } from "@ant-design/icons";
import Notifier from "react-desktop-notification";
import {
  MemberDetails,
  MeetingDetails,
  UserMeetingStatusUpdateDetails,
} from "types";
import {
  addCurrentMeeting,
  deleteCurrentMeeting,
  openCreateMeetingModal,
  updateUserMeetingStatus,
  refreshMeetingViewer,
  selectMeetingViewerKey,
  selectDashboardKey,
  deleteMeetingInRange,
  addMeetingInRange,
  updateMeetingInRange,
} from "slices/meetingsSlice";
import { refreshDashboard } from "slices/meetingsSlice";
import {
  selectFavouritesKey,
  updateForLocationChange,
  updateFavouritesOnlineStatus,
  fetchFavourites,
  selectFavourites,
  selectFavouritesRetrieved,
} from "slices/favouritesSlice";
import {
  refreshUsers,
  selectLoggedInUsersName,
  setLoggedInUsersName,
} from "slices/usersSlice";
import "./Home.css";
import MeetingViewer from "./MeetingViewer";
import EditMeeting from "components/EditMeeting";
import Settings from "./Settings";
import MeetingCalendar from "./MeetingCalendar";
import Group from "./Group";
import { setGroup, selectGroupsKey, fetchNonFavouriteGroups, selectGroups, refreshMembers, selectGroupRetrieved, selectAllGroupsRetrieved, openCreateGroupModal, selectSideBarKey } from "slices/groupSlice";
import CreateGroupModal from "components/CreateGroupModal";
const { Content } = Layout;

let socket;
let call_all_notify;
let notify, notify_now;

const Home = () => {
  const params = new URLSearchParams(document.location.search);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (access_token) {
    document.cookie = `access_token=${access_token}; path=/home; Secure`;
  }
  if (refresh_token) {
    document.cookie = `refresh_token=${refresh_token}; path=/home; Secure`;
  }

  if (!getCookieValue("access_token") || !getCookieValue("refresh_token")) {
    window.location.href = "/";
  }
  const [render, updateRender] = useState(1);
  const [isEmailInCookies, setIsEmailInCookies] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const meetingViewerKey = useSelector(selectMeetingViewerKey);
  const favouritesKey = useSelector(selectFavouritesKey);
  const dashboardKey = useSelector(selectDashboardKey);
  const groupsKey = useSelector(selectGroupsKey);
  const favourites: MemberDetails[] = useSelector(selectFavourites);
  const favouritesRetrieved: boolean = useSelector(selectFavouritesRetrieved);
  const groupsRetrieved: boolean = useSelector(selectAllGroupsRetrieved);
  const loggedInUsersName: string = useSelector(selectLoggedInUsersName);
  const groups = useSelector(selectGroups);
  const sideBarKey = useSelector(selectSideBarKey);
  const dispatch = useDispatch();

  useEffect(() => {
    async function fetchEmailAndName() {
      try {
        const data: any = await axios.get(
          "https://cpa6s5u7uh.execute-api.us-west-2.amazonaws.com/v1/users/me",
          {
            headers: {
              access_token: getCookieValue("access_token"),
              refresh_token: getCookieValue("refresh_token"),
            },
          }
        );
        console.log(data);
        window.history.replaceState(null, "Dashboard Home", "/home");
        dispatch(setLoggedInUsersName(data.data.body.name));
        document.cookie = `email=${data.data.body.email};path=/home; Secure`;
        updateCookies(data);
        setIsEmailInCookies(true);
        console.log(getCookieValue("email"));
        if (!favouritesRetrieved) {
          dispatch(fetchFavourites());
        }
        dispatch(fetchNonFavouriteGroups());
      } catch (err) {
        console.error(err);
      }
    }

    async function fetchGroups() {
      try {
        dispatch(fetchNonFavouriteGroups());
      } catch (err) {
        console.error(err);
      }
    }
    fetchEmailAndName();
    //fetchGroups()
  }, []);

  useEffect(() => {
    if (!favouritesRetrieved && isEmailInCookies) {
      dispatch(fetchFavourites());
    }
  }, [favouritesRetrieved]);

  useEffect(() => {
    if (!groupsRetrieved && isEmailInCookies) {
      dispatch(fetchNonFavouriteGroups());
    }
  }, [groupsRetrieved]);

  useEffect(() => {
    console.log(getCookieValue("email"));
    if (isEmailInCookies) {
      console.log(getCookieValue("email"));
      socket = new WebSocket(
        "wss://qm9ci7cj1a.execute-api.us-west-2.amazonaws.com/v1"
      );

      socket.onopen = () => {
        setIsWebSocketConnected(true);
        socket.send(
          JSON.stringify({ action: "LOG_IN", data: getCookieValue("email") })
        );
      };

      socket.onmessage = (event: any) => {
        event = JSON.parse(event.data);
        let meeting: MeetingDetails;
        let userMeetingStatusUpdateDetails: UserMeetingStatusUpdateDetails;
        let email: string;
        let isFavourite: boolean;

        switch (event.event) {
          case "MEETING_START":
            console.log("meeting start");
            meeting = event.body;
            dispatch(addCurrentMeeting(meeting));
            break;
          case "MEETING_END":
            meeting = event.body;
            console.log("meeting end");
            dispatch(deleteCurrentMeeting(meeting));
            break;
          case "USER_JOINED":
            console.log("user joined ");
            userMeetingStatusUpdateDetails = event.body;
            userMeetingStatusUpdateDetails["userIsOn"] = 1;

            email = userMeetingStatusUpdateDetails.email;
            isFavourite =
              favourites.filter((favourite) => favourite.email == email)
                .length > 0;
            userMeetingStatusUpdateDetails["isFavourite"] = isFavourite;
            dispatch(updateUserMeetingStatus(userMeetingStatusUpdateDetails));
            dispatch(
              updateForLocationChange({
                email: event.body.email,
                location: event.body.title,
              })
            );
            break;
          case "USER_LEFT":
            console.log("user left");
            userMeetingStatusUpdateDetails = event.body;
            userMeetingStatusUpdateDetails["userIsOn"] = 0;
            dispatch(updateUserMeetingStatus(userMeetingStatusUpdateDetails));
            dispatch(
              updateForLocationChange({
                email: event.body.email,
                location: null,
              })
            );
            break;
          case "LOG_IN":
            console.log("log in");
            dispatch(
              updateFavouritesOnlineStatus({
                email: event.body.email,
                onlineStatus: 1,
              })
            );
            break;
          case "LOG_OUT":
            console.log("log out");
            dispatch(
              updateFavouritesOnlineStatus({
                email: event.body.email,
                onlineStatus: 0,
              })
            );
            break;
          case "NOTIFY_30":
            notify(event.body, "in 30mins");
            break;
          case "NOTIFY_15":
            notify(event.body, "in 15mins");
            break;
          case "NOTIFY_NOW":
            notify_now(event.body);
            break;
          case "CALL_ALL":
            call_all_notify(event.body);
            break;
          case "NEW_MEETING":
            console.log("new meeting");
            dispatch(addMeetingInRange(event.body));
            break;
          case "UPDATED_MEETING":
            console.log("updated meeting");
            dispatch(updateMeetingInRange(event.body));
            break;
          case "DELETED_MEETING":
            console.log("delete meeting");
            dispatch(deleteMeetingInRange(event.body.id));
            break;
        }
      };
    }
  }, [isEmailInCookies]);

  if (!isEmailInCookies || !isWebSocketConnected || !favouritesRetrieved) {
    return <LoadingSpinner />;
  }

  const deleteAllCookies = () => {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  };

  notify = (w_event, time) => {
    const email = getCookieValue("email");
    if (
      w_event.participants.some((n) => {
        return n.email.toLowerCase().includes(email);
      })
    ) {
      Notifier.start(
        `${w_event.title} reminder`,
        `Your meeting starts ${time}.
            \nClick to join now`,
        `${w_event.join_url}`,
        "https://github.com/Lambda319/FrontEnd/blob/main/src/assets/Lambda319Logo.png"
      );
    }
  };

  notify_now = (w_event) => {
    const email = getCookieValue("email");
    if (
      w_event.host_email !== email &&
      w_event.participants.some((n) => {
        return n.email.toLowerCase().includes(email);
      })
    ) {
      displayNotification(
        `Meeting '${w_event.title}' is starting`,
        `Click to join ${w_event.title} now`,
        w_event.join_url,
        "Join Meeting",
        "join-button"
      );

      Notifier.start(
        `Your meeting is starting now`,
        ` 
            \nClick to join '${w_event.title}' now`,
        `${w_event.join_url}`,
        "https://github.com/Lambda319/FrontEnd/blob/main/src/assets/Lambda319Logo.png"
      );
    }
  };

  const handleCallAnswered = (key, url) => {
    window.open(url, "_other");
    notification.close(key);
  };

  call_all_notify = (w_event) => {
    const email = getCookieValue("email");
    if (
      w_event.host_email !== email &&
      w_event.participants.some((n) => {
        return n.email.toLowerCase().includes(email);
      })
    ) {
      displayNotification(
        `Incoming Call From ${w_event.host}`,
        `Click to join ${w_event.title}`,
        w_event.join_url
      );

      Notifier.start(
        `Call From '${w_event.host}'`,
        ` 
            \nClick to answer`,
        `${w_event.join_url}`,
        "https://github.com/Lambda319/FrontEnd/blob/main/src/assets/Lambda319Logo.png"
      );
    }
  };

  const displayNotification = (
    title,
    description,
    join_url,
    btnText = "Accept (Join Meeting)",
    classname = "accept-button"
  ) => {
    const key = `open${Date.now()}`;
    const btn = (
      <Button
        type="primary"
        className={classname}
        size="large"
        onClick={() => handleCallAnswered(key, join_url)}
      >
        {btnText}
      </Button>
    );
    notification.open({
      message: title,
      description: description,
      btn,
      key,
      duration: 0,
      onClick: () => handleCallAnswered(key, join_url),
      icon: <PhoneTwoTone />,
    });
  };

  /* Pattern based off of https://codesandbox.io/s/antd-menu-click-rendering-q54h1 */
  const components = {
    1: <Dashboard key={dashboardKey} />,
    2: <MeetingViewer key={meetingViewerKey} />,
    10: <MeetingCalendar key={meetingViewerKey}/>,
    3: <Favourites key={favouritesKey} />,
    4: <NewMeeting />,
    5: <Settings />,
    6: <Group key={groupsKey}/>
  };

  const handleMenuClick = (menu) => {
    if (menu.key === "4") {
      dispatch(openCreateMeetingModal(true));
    } else if (menu.key === "8") {
      dispatch(openCreateGroupModal());
    } 
    else {
      if (menu.key === "1") {
        dispatch(refreshDashboard());
      } else if (menu.key === "2" || menu.key === "10") {
        dispatch(refreshMeetingViewer());
      } else if (menu.key === "3") {
        dispatch(refreshUsers());
      }
      updateRender(menu.key);
    }
  };

  const handleGroup = (id) => {
   dispatch(setGroup(id));
   dispatch(refreshMembers());
   updateRender(6);
  };

  const getUsername = () => {
    return loggedInUsersName;
  };

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      <Sidebar
        handleClick={handleMenuClick}
        deleteAllCookies={deleteAllCookies}
        getUsername={getUsername}
        handleGroup={handleGroup}
        groups={groups ?? []}
        key={sideBarKey}
      />
      <Layout>
        <Content>{components[render]}</Content>
        <NewMeeting />
        <EditMeeting />
        <CreateGroupModal />
      </Layout>
    </Layout>
  );
};

export default Home;
