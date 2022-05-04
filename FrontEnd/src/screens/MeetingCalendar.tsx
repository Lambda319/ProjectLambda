import React, {useEffect, useState} from "react";
import "./Dashboard.css";
import {useSelector} from "react-redux";
import {Layout, Button, Modal, message, Space, Calendar, Badge, List, Tooltip, Card, Tag, Popconfirm, Menu, Dropdown} from "antd";
import { HelpType, MeetingDetails } from "../types";
import SearchBar from "../components/SearchBar";
import SortButtonMeeting from "../components/SortButton";
import {
    fetchMeetingsInRange,
    selectMeetingsInRangeIsLoading,
    selectMeetingsInRangeRetrieved,
    selectMeetingsInRange,
    sortMeetingsInRange,
    openEditMeetingModal,
    deleteMeeting,
    refreshMeetingViewer,
} from "../slices/meetingsSlice";
import {
    LinkOutlined,
    DeleteTwoTone, DeleteOutlined,
    PlaySquareTwoTone, PlaySquareOutlined,EditTwoTone, EditOutlined,
    PhoneTwoTone, PhoneOutlined,
    ClockCircleTwoTone,
    ArrowRightOutlined,
    TeamOutlined,
    SyncOutlined,
    CheckCircleOutlined, ClockCircleOutlined
} from "@ant-design/icons";
import LoadingSpinner from "components/LoadingSpinner";
import {useAppDispatch} from "store";
import * as moment from "moment";
import HelpButton from "components/HelpButton";
import { getCookieValue } from "common";

const { Content } = Layout;
export default function MeetingCalendar() {
    async function fetchMeetings() {
        try {
            await dispatch(fetchMeetingsInRange({
                start_time: startTime,
                end_time: endTime,
                recurse: recurse,
            }));
            dispatch(sortMeetingsInRange());
            // TODO error handling
            message.success("Meetings fetched!");
        } catch (err) {
            // Modal.error({
            //     content: `An error occurred during fetch meetings. ${err}`,
            //     centered: true,
            // }); // temp solution
        }
    }

    const startDay: moment.Moment = moment().subtract(45, "day");
    const endDay: moment.Moment = moment().add(45, "day");
    const [startTime, setStartTime] = useState(startDay.unix() * 1000);
    const [endTime, setEndTime] = useState(endDay.unix() * 1000);
    const [selectedTime, setSelectedTime] = useState(moment())
    const [recurse, setRecurse] = useState(false);
    const dispatch = useAppDispatch();
    const page = "meeting viewer";
    const meetings: MeetingDetails[] = useSelector(selectMeetingsInRange);
    const loading: boolean = useSelector(selectMeetingsInRangeIsLoading);
    const meetingsRetrieved: boolean = useSelector(selectMeetingsInRangeRetrieved);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isMeetingModalVisible, setIsMeetingModalVisible] = useState(false);
    const [meetingList, setMeetingList] = useState<MeetingDetails[]>()
    const [isFirst, setIsFirst] = useState(true)
    const [openedMeeting, setOpenedMeeting] = useState<MeetingDetails>()
    const userEmail: string = getCookieValue("email");
    const userIsInvited = () => {
        if (openedMeeting) {
            if (openedMeeting.participants.filter((participant) => participant.email == userEmail).length > 0) 
                return true
        }
        return false;
    }
    const participantCount = openedMeeting?.participants.length;
    const participantCountString = `${participantCount} ` + (participantCount === 1? 'Participant' : 'Participants');
    const userIsOwnerOfMeeting: boolean = openedMeeting?.organizer_email == userEmail;
    const meetingHasEnded: boolean = openedMeeting?.status == 2;
    const meetingIsInProgress: boolean = openedMeeting?.status == 1;
    const meetingIsPast: boolean = moment(openedMeeting?.start_time).isBefore(moment());
    const meetingIsBeforeCutOff: boolean = moment(openedMeeting?.start_time).isBefore(moment().subtract(12, "hours"));
    const recordings = openedMeeting?.download_link || [];


    useEffect(() => {
        fetchMeetings();
    }, [startTime, endTime, recurse]);

    useEffect( () =>{
        if (!meetings || meetings.length === 0) {return}
        const list = meetings.filter(m => moment(m.start_time).dayOfYear() === moment(selectedTime).dayOfYear());
        if (list.length === 0) {
            return;
        }

        setMeetingList(list);
        if (isFirst) {
             setIsFirst(false);
            return;
        }
            setIsModalVisible(true);

    }, [selectedTime]);


    const getClassname = (participant) => {
        let className = "participant ";
        className += participant.is_in_meeting ? "in-meeting " : "not-in-meeting ";
        className += participant.was_invited ? "invited " : "not-invited ";
        className += participant.attended ? "attended " : "not-attended ";

        return className;
    }
    
    const getParticipantBadgeColor = (participant) => {
        if (participant.attended && participant.was_invited){
            return "#eea809"
        }
        if (participant.attended && !participant.was_invited){
            return "#2356CCFF"
        }
        return "grey";
    }

    const getTooltip = (participant) => {
        let msg = "";
        if (participant.attended) {
            msg += "attended"
        } else if (openedMeeting?.status !== 0){
            msg += "did not attend"
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

    const getReturnName = (participant) => {
        let returnName = participant.name;
        if (participant.is_favorite) {
            returnName = "".concat(participant.name, " ★");
        }
        return returnName;
    }

    const getMeetingTag = (className) => {
        return meetingIsInProgress ? <Tag icon={<SyncOutlined/>} className={"tag progress " + className} color="green">In Progress</Tag> :
             meetingHasEnded ? <Tag icon={<CheckCircleOutlined/>}className={"tag " + className}>Ended</Tag>
                 : <Tag icon={<ClockCircleOutlined/>} className={"tag " + className} color="blue">Scheduled</Tag>
     }

    const getMeetingTagDetailView = () => {
        return getMeetingTag("meeting-details-tag")
    }

    const joinDisabled = !((userIsInvited() || userIsOwnerOfMeeting) && !(meetingIsPast && meetingIsBeforeCutOff ))
    const joinButton = joinDisabled ? null :
        <Tooltip title={"Join Meeting"} mouseEnterDelay={1}>
            <Button icon={!joinDisabled ? <PhoneTwoTone twoToneColor="rgba(56,158,13,0.87)"/> :<PhoneOutlined/>}
                    shape="round"
                    type="text"
                    disabled={joinDisabled}
                    onClick={(e) => {
                        setIsMeetingModalVisible(false);
                        window.open(`${openedMeeting?.join_url}`);
                        e.stopPropagation()
                        e.preventDefault();
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
                        setIsMeetingModalVisible(false);
                        dispatch(openEditMeetingModal(openedMeeting));
                        e.stopPropagation()
                        e.preventDefault();
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
                    setIsMeetingModalVisible(false);
                    try {
                        if (openedMeeting) dispatch(deleteMeeting(openedMeeting.id));
                        message.success(`"${openedMeeting?.title}" deleted.`)
                    } catch {
                        message.error(`There was an error deleting the meeting "${openedMeeting?.title}".`)
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
    
    const recordingsMenu = (
        <Menu onClick={handleViewRecording}>
            {recordings.map( (recording) => {
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

    const getMeetingView = () => {
        return <>
                <p className="details-text details-text-first">
                    Began: <b>{moment(openedMeeting?.start_time).format("hh:mma")}</b>
                </p>
                <p className="details-text">
                    Scheduled to end: <b>{moment(openedMeeting?.end_time).format("hh:mma")}</b>
                </p>
                <p className="details-text">
                    Organizer: <b>{openedMeeting?.organizer_host}</b>
                    <p>{participantCountString}</p>
                </p>
                <p className="details-header">Participants:</p>
                <div className="details-participants" >
                    <List
                        dataSource={openedMeeting?.participants}
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
                </div>
                {getMeetingTagDetailView()}
            </>;
    }

    const getListView = () => {
        return <>
            <h3>{selectedTime.format("YYYY-MM-DD")}</h3>
            <div className="scrollable-meetings">
            <List
            dataSource={meetingList}
            size={"small"}
            split={false}
            renderItem={meeting => (
                <List.Item key={meeting.id}
                           style={{fontSize:"12px"}}>
                    <>
                    <Card key={meeting.id}
                          onClick={() => {
                            setOpenedMeeting(meeting)
                            setIsMeetingModalVisible(true)}}
                          hoverable={true}
                          extra={meeting.organizer_host}
                          title={meeting.title}
                          style={{width: "450px", margin:"auto"}}
                          size={"small"}>
                        <p>
                            <ClockCircleTwoTone/> {moment(meeting.start_time).format("hh:mma")} {<ArrowRightOutlined />} {moment(meeting.end_time).format("hh:mma")}
                        </p>
                    <p>

                        </p>
                        <p>
                            {<TeamOutlined />}{meeting.participants.length}
                            </p>
                        {meeting.status === 1 ? <Tag icon={<SyncOutlined/>} className={"tag meeting-tag progress"} color="green">In Progress</Tag> :
                        meeting.status === 2 ? <Tag icon={<CheckCircleOutlined/>}className={"tag meeting-tag"}>Ended</Tag>
                        : <Tag icon={<ClockCircleOutlined/>} className={"tag meeting-tag"} color="blue">Scheduled</Tag>}
                    </Card>
                    </>
                </List.Item>
                
            )}
        />
            </div>
            </>;
    }

    const updateTime = (selectedTime) => {
        const t = moment(selectedTime)
        setSelectedTime(selectedTime);
        setStartTime(t.subtract(45, 'd').unix() * 1000);
        setEndTime(t.add(90, 'd').unix() * 1000);
    }

    const dayRendered = (date) => {
        if (!meetings || meetings.length === 0){
            return <></>
        }
        const meetingsToday = meetings.filter(m => moment(m.start_time).dayOfYear() === moment(date).dayOfYear());

        if (meetingsToday.length === 0 ){
            return <></>
        }
       return(
           <ul className="events" style={{fontSize:"10px"}}>
               {meetingsToday.length === 1? "1 meeting": meetingsToday.length  + " meetings"}
               {meetingsToday.map( (meeting) => {
                  return <Tooltip key={meeting.id}
                                    title={meeting.title + " @ " + moment(meeting.start_time).format("hh:MM:a") + " -- hosted by: " + meeting.organizer_host}
                                    mouseEnterDelay={0.8}
                                    placement={"left"}>
                      <Button key={meeting.id} type={"primary"}
                              shape={"round"}
                              style={{fontSize: "10px", width: "100%", textAlign: "left", }}
                              size={"small"}
                              className={"meeting-button " + (+meeting.status === 0 ? "zero" : (+meeting.status === 1 ? "one" : "two"))}
                              onClick={ (e) => {
                                  setOpenedMeeting(meeting)
                                  setIsMeetingModalVisible(true)
                                  e.stopPropagation()
                                }}
                              >
                          {meeting.title}
                      </Button>
                  </Tooltip>
               })}
           </ul>)
    }

    return (
        <Layout className="site-layout">
            <div
                className="site-layout-background header-text"
                style={{ padding: 10, paddingLeft: 25 }}
            >
                All Meetings
            </div>
            <Content style={{ margin: "0", paddingLeft: 50, paddingRight: 50 }}>
                <div className="tools-wrapper">
                    <Space direction="vertical">
                        <Space size="large">
                            <Space>
                                <SearchBar page={page} />
                                <SortButtonMeeting page={page} />
                                <Button onClick={() => {setRecurse(!recurse);} }>
                                    View Only My Team: {recurse ? "Off" : "On"}
                                </Button>
                            </Space>
                            <HelpButton type={HelpType.MeetingCalendar}/>
                        </Space>
                    </Space>
                </div>
                {  (loading || !meetingsRetrieved) ? <LoadingSpinner /> :
                    <><Space direction={"vertical"} size={20}>
                        <div/>
                        <Calendar
                            value={selectedTime}
                            onPanelChange={d => {
                                updateTime(d);
                            }}
                            onSelect={(time) => {
                                setSelectedTime(time)
                            }}
                            dateCellRender={d => dayRendered(d)}/>
                    </Space>
                        <Modal
                            footer={null}
                        visible={isModalVisible}
                            onOk={() => {
                            setIsModalVisible(false);
                        }}
                            onCancel={() => {
                            setIsModalVisible(false);
                        }}>
                            {getListView()}
                        </Modal>
                        <Modal
                        title={openedMeeting?.title}
                        visible={isMeetingModalVisible}
                        onOk={() => {
                            setIsMeetingModalVisible(false);
                        }}
                        onCancel={() => {
                            setIsMeetingModalVisible(false);
                        }}
                        footer={[joinButton, editButton, deleteButton, recordingButton]}
                        >
                            {getMeetingView()}
                        </Modal>
                        </>
                }
            </Content>
        </Layout>
    );
}
