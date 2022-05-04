import {
    Badge,
    Button,
    Card,
    Dropdown, List,
    Menu,
    message,
    Modal,
    Popconfirm,
    Tag,
    Tooltip
} from "antd";
import { MeetingDetails } from "../types";
import React, { useState } from "react";
import "../card.css";
import { getCookieValue } from "common";
import { useDispatch } from "react-redux";
import { deleteMeeting, openEditMeetingModal, refreshMeetingViewer } from "slices/meetingsSlice";
import moment from "moment";

import {
    CheckCircleOutlined,
    SyncOutlined,
    ClockCircleOutlined,
    LinkOutlined,
    DeleteTwoTone, DeleteOutlined,
    PlaySquareTwoTone, PlaySquareOutlined,EditTwoTone, EditOutlined,
    PhoneTwoTone, PhoneOutlined
} from '@ant-design/icons';

export default function MeetingCard({
                                        meeting, fromDashboard
                                    }: {
    meeting: MeetingDetails;
    fromDashboard?: boolean;
}): JSX.Element {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const userEmail: string = getCookieValue("email");
    const userIsInvited: boolean =
        meeting.participants.filter((participant) => participant.email == userEmail)
            .length > 0;
    const participantCount = meeting.participants.length;
    const participantCountString = `${participantCount} ` + (participantCount === 1? 'Participant' : 'Participants');
    const userIsOwnerOfMeeting: boolean = meeting.organizer_email == userEmail;
    const meetingHasEnded: boolean = meeting.status == 2;
    const meetingIsInProgress: boolean = meeting.status == 1;
    const meetingIsPast: boolean = moment(meeting.start_time).isBefore(moment());
    const meetingIsBeforeCutOff: boolean = moment(meeting.start_time).isBefore(moment().subtract(12, "hours"));
    const recordings = meeting?.download_link || [];
    const dispatch = useDispatch();

    const getClassname = (participant) => {
        let className = "participant ";
        className += fromDashboard ? "dashboard " : "viewer ";
        className += participant.is_in_meeting ? "in-meeting " : "not-in-meeting ";
        className += participant.was_invited ? "invited " : "not-invited ";
        className += participant.attended ? "attended " : "not-attended ";

        return className;
    }

    const getParticipantBadgeColor = (participant) => {
        if (fromDashboard){
            if (!participant.is_in_meeting){
                return "grey";
            }
            if (participant.is_in_meeting && participant.was_invited){
                return "#00a13b";
            }
            if (participant.is_in_meeting && !participant.was_invited){
                return "#2356CCFF";
            }
        }else {
            if (participant.attended && participant.was_invited){
                return "#eea809"
            }
            if (participant.attended && !participant.was_invited){
                return "#2356CCFF"

            }
        }
        return "grey";
    }

    const getTooltip = (participant) => {
        let msg = "";
        if (fromDashboard) {
            if (participant.is_in_meeting) {
                msg += "is in the meeting"
            } else {
                msg += "not in the meeting"
            }
        }else{
            if (participant.attended) {
                msg += "attended"
            } else if (meeting.status !== 0){
                msg += "did not attend"
            }
        }
        if (msg !== ""){
            msg += ", "
        }
        if (participant.was_invited){
            msg+= "invited"
        }else{
            msg+= "not invited"
        }
        return msg;
    }

    const handleViewRecording = (recording) => {
        window.open(recording.key, "_other");
    }

    const getRecordingDisplayName = (recording) => {
        let time = new Date(+recording.time).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
        if (recording.play_url === "in_process"){
            time += " - Processing.."
        }
        return time;
    }



    const meetingStartDate: string = new Date(
        meeting.start_time
    ).toLocaleDateString("en-CA");
    const meetingStartTime: string = new Date(
        meeting.start_time
    ).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
    const meetingEndDate: string = new Date(
        meeting.end_time
    ).toLocaleDateString("en-CA");
    const meetingEndTime: string = new Date(
        meeting.end_time
    ).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });


    const getReturnName = (participant) => {
        let returnName = participant.name;
        if (participant.is_favorite) {
            returnName = "".concat(participant.name, " ★");
        }
        return returnName;
    }

    const renderedParticipantList =
        <List
            dataSource={meeting.participants}
            size="small"
            split={false}
            renderItem={participant => (
                <List.Item key={participant.email}
                           style={{fontSize:"14px"}}>
                    <Tooltip key={participant.email} placement="left" title={getTooltip(participant)} mouseEnterDelay={0.2}>
                        <Badge color={getParticipantBadgeColor(participant)}
                               title={getTooltip(participant)}
                               status="default"
                               style={{fontSize:"14px"}}
                               className={getClassname(participant) + "dot"} />
                        {getReturnName(participant)}
                    </Tooltip>
                </List.Item>
            )}
        />


    const getMeetingTagCardView = () => {
        return getMeetingTag("meeting-tag");
    }

    const getMeetingTagDetailView = () => {
        return getMeetingTag("meeting-details-tag")
    }

    const getMeetingTag = (className) => {
       return meetingIsInProgress ? <Tag icon={<SyncOutlined/>} className={"tag progress " + className} color="green">In Progress</Tag> :
            meetingHasEnded ? <Tag icon={<CheckCircleOutlined/>}className={"tag " + className}>Ended</Tag>
                : <Tag icon={<ClockCircleOutlined/>} className={"tag " + className} color="blue">Scheduled</Tag>
    }


    const joinDisabled = !((userIsInvited || userIsOwnerOfMeeting) && !(meetingIsPast && meetingIsBeforeCutOff ))
    const joinButton = joinDisabled ? null :
        <Tooltip title={"Join Meeting"} mouseEnterDelay={1}>
            <Button icon={!joinDisabled ? <PhoneTwoTone twoToneColor="rgba(56,158,13,0.87)"/> :<PhoneOutlined/>}
                    shape="round"
                    type="text"
                    disabled={joinDisabled}
                    onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault();
                        setIsModalVisible(false);
                        window.open(`${meeting.join_url}`);
                    }}
            >
            </Button>
        </Tooltip>;


    const editDeleteDisabled = !(!meetingHasEnded && !meetingIsInProgress && userIsOwnerOfMeeting && !meetingIsPast)

    const editButton = editDeleteDisabled ? null:
        <Tooltip title="Edit Meeting" mouseEnterDelay={1}>
            <Button icon={editDeleteDisabled ? <EditOutlined/>: <EditTwoTone/> }
                    shape="round"
                    type="text"
                    disabled={editDeleteDisabled}
                    onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault();
                        setIsModalVisible(false);
                        dispatch(openEditMeetingModal(meeting));
                    }}
            >
            </Button>
        </Tooltip>;


    const deleteButton = editDeleteDisabled? null:
        <Tooltip title="Delete Meeting" mouseEnterDelay={1}>
            <Popconfirm
                title="Are you sure you want to delete this meeting?"
                onConfirm={async (e) => {
                    e?.stopPropagation()
                    e?.preventDefault()
                    setIsModalVisible(false);
                    try {
                        dispatch(deleteMeeting(meeting.id));
                        message.success(`"${meeting.title}" deleted.`)
                    } catch {
                        message.error(`There was an error deleting the meeting "${meeting.title}".`)
                    }
                    refreshMeetingViewer();
                }}
                onCancel={ (e) => {
                    e?.stopPropagation()
                    e?.preventDefault()
                }
                }
            >
                <Button  icon={!editDeleteDisabled ? <DeleteTwoTone twoToneColor="#ff7875"/> :<DeleteOutlined/>}
                         shape="round"
                         type="text"
                         disabled={editDeleteDisabled}
                onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                }
                }>
                </Button>
            </Popconfirm>
        </Tooltip>



    const recordingsMenu = (
        <Menu onClick={handleViewRecording}>
            {recordings.map( (recording) => {
                console.log(recording);
                return <Menu.Item key={recording.play_url === 'in_process' ? recording.time:recording.play_url}
                                  disabled={recording.play_url === 'in_process'}
                                  icon={recording.play_url === 'in_process' ? <SyncOutlined spin/> : <LinkOutlined />}>
                    {getRecordingDisplayName(recording)}</Menu.Item>
            })}
        </Menu>
    );

    const recordingButton = recordings.length <= 0? null:
        <Tooltip title="View Recordings" mouseEnterDelay={1}>
            <Dropdown disabled={!(recordings?.length > 0)} overlay={recordingsMenu}>

                <Button icon={recordings?.length > 0 ? <PlaySquareTwoTone/> : <PlaySquareOutlined/>} shape="round"
                        type="text">
                </Button>

            </Dropdown>
        </Tooltip>


    return (
        <>
            <Card onClick={() => setIsModalVisible(true)} className="meeting-card"
                  hoverable={true}>
                <p className="meeting-card-title" style={{whiteSpace:"nowrap"}}> {meeting.title}</p>
                <div className="meeting-card-info">
                    <p>Began: {meetingStartDate + ", " + meetingStartTime}</p>
                    <p>End: {meetingEndDate + ", " + meetingEndTime}</p>
                    <p>Organizer: {meeting.organizer_host}</p>
                    <p>{participantCountString}</p>
                </div>
                <div
                    className="participants"

                > <div className="card-participants" >
                    {renderedParticipantList}
                </div>
                    <div className="button-div">
                        {joinButton}
                        {editButton}
                        {deleteButton}
                        {recordingButton}
                    </div>
                </div>
                {getMeetingTagCardView()}
            </Card>


            <Modal
                title={meeting.title}
                visible={isModalVisible}
                onOk={() => {
                    setIsModalVisible(false);
                }}
                onCancel={() => {
                    setIsModalVisible(false);
                }}
                footer={[joinButton, editButton, deleteButton, recordingButton]}
            >
                <p className="details-text details-text-first">
                    Began: <b>{meetingStartDate}, {meetingStartTime}</b>
                </p>
                <p className="details-text">
                    Scheduled to end: <b>{meetingEndDate}, {meetingEndTime}</b>
                </p>
                <p className="details-text">
                    Organizer: <b>{meeting.organizer_host}</b>
                    <p>{participantCountString}</p>
                </p>
                <p className="details-header">Participants:</p>

                <div className="details-participants" >

                    {renderedParticipantList}

                </div>
                {getMeetingTagDetailView()}
            </Modal>
        </>
    );
}