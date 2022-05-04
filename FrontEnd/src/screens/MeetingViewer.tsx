import React, {useEffect, useState} from "react";
import "./Dashboard.css";
import {useSelector} from "react-redux";
import {Layout, Col, Row, Button, Modal, message, Empty, Space} from "antd";
import MeetingCard from "../components/MeetingCard";
import { HelpType, MeetingDetails } from "../types";
import SearchBar from "../components/SearchBar";
import SortButtonMeeting from "../components/SortButton";
import {
    fetchMeetingsInRange,
    selectMeetingsInRangeIsLoading,
    selectMeetingsInRangeRetrieved,
    selectMeetingsInRange,
    sortMeetingsInRange,
} from "../slices/meetingsSlice";
import LoadingSpinner from "components/LoadingSpinner";
import MeetingViewerFilter from "components/MeetingViewerFilter";
import {useAppDispatch} from "store";
import * as moment from "moment";
import HelpButton from "components/HelpButton";

const { Content } = Layout;
export default function MeetingViewer() {
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

    const dayBefore: moment.Moment = moment().subtract(1, "day");
    const dayAfter: moment.Moment = moment().add(1, "day");
    const [startTime, setStartTime] = useState(dayBefore.unix() * 1000);
    const [endTime, setEndTime] = useState(dayAfter.unix() * 1000);
    const [recurse, setRecurse] = useState(false);
    const dispatch = useAppDispatch();
    const page = "meeting viewer";
    const meetings: MeetingDetails[] = useSelector(selectMeetingsInRange);
    const loading: boolean = useSelector(selectMeetingsInRangeIsLoading);
    const meetingsRetrieved: boolean = useSelector(selectMeetingsInRangeRetrieved);

    useEffect(() => {
        fetchMeetings();
    }, [startTime, endTime, recurse]);

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
                            <HelpButton type={HelpType.MeetingViewer}/>
                        </Space>
                        <MeetingViewerFilter initialStart={dayBefore} initialEnd={dayAfter} onSubmit={(start, end) => {setStartTime(start); setEndTime(end);}}/>
                    </Space>
                </div>
                {  (loading || !meetingsRetrieved) ? <LoadingSpinner /> : (meetings?.length >= 1) ?
                    <Space direction="vertical" size={20}>
                        <div/>
                        <Row
                            className="row-style"
                            gutter={[24, 20]}
                        >
                            {meetings &&
                                meetings.map((meeting: MeetingDetails, key) => (
                                    <Col key={key}>
                                        <MeetingCard meeting={meeting} />
                                    </Col>
                                ))}
                        </Row>
                    </Space>
                    : <Empty />
                }
            </Content>
        </Layout>
    );
}
