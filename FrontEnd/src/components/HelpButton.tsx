import React from "react";
import { Button, Modal, Tooltip } from "antd";
import {
    QuestionOutlined
  } from '@ant-design/icons';
import { HelpType } from "types";

export default function HelpButton({type}: {type: HelpType}): JSX.Element {

    const showModal = () => {
        let content: React.ReactNode = "";
        if (type === HelpType.Dashboard) {
            content = <div><p>The Project Lambda Dashboard or Home Screen features sidebar navigation to other pages, all current ongoing meetings, and functions regarding these meetings.</p>

            <p>All meetings are displayed in clickable cards, which can be clicked to expand these meetings to show all invited participants and additional meeting details. Users will have a green badge when invited and in the meeting, a grey badge if not in the meeting, and a blue badge if they were not invited and in the meeting. Users that you have added to your Favourites list will be marked with a star icon.</p>
            
            <p>Searching and sorting through the meetings are made possible through the respective search and sort bars/buttons. You can search by meeting title or participant name, and meetings can be sorted by meeting name or meeting time, ascending or descending.</p></div>
        } else if (type === HelpType.MeetingViewer) {
            content = <>
                <p>The Meeting Viewer has the same meeting card functionality as the Dashboard, with a few additional features.</p>

                <p>To see the range of all meetings between two dates aside from the default range, input a new starting date and a new ending date.</p>

                <p>If a meeting has recordings, a dropdown will be displayed to access these recordings through a link to the Zoom view recording page.</p>

                <p>If viewing future meetings, you may edit or delete meetings that you are the host of, in addition to being able to click into any card to see all details regarding that meeting.</p>

                <p>Searching and sorting through a set of meetings is identical in function to the Dashboard.</p>
            </>
        } else if (type === HelpType.MeetingCalendar) {
            content = <>
                <p>The Meeting Calendar has the same search and sort functionality as the Meeting Viewer, but all meetings can be seen in a calendar view.</p>

                <p>Please see the help modal in the Meeting Viewer for all similar functions.</p>

                <p>Clicking into a day will show you a list view of all meetings in that day, and clicking on any meeting will show you a detailed view.</p>
            </>
        } else if (type === HelpType.Favourites) {
            content = <>
                <p>The Favourites page displays all your favourite users, their statuses, and functions regarding your favourites.</p>

                <p>A number of buttons at the top will allow you to make an instant meeting with all or selected users, add or delete users, and search and sort through users.</p>

                <p>You may search by name or email, and sort by name, status, or location.</p>

                <p>You cannot delete your favourites list.</p>
            </>
        } else {
            content = <>
                <p>A Groups page displays all your the users in a group, their statuses, and functions regarding the group.</p>

                <p>A number of buttons at the top will allow you to make an instant meeting with all or selected users, add or delete users, and search and sort through users.</p>

                <p>You may search by name or email, and sort by name, status, or location.</p>

                <p>You can add a group using a button in the sidebar. Groups can also be deleted by clicking the delete button.</p>
            </>
        }
        Modal.info({title:`Help: ${type}`, content: content, maskClosable: true, width: "70vh", centered: true});
    }
    return(
        <Tooltip title="Help">
            <Button shape="circle" onClick={showModal}><QuestionOutlined /></Button>
        </Tooltip>
    );
}