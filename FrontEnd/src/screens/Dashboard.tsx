import React, { useEffect } from "react";
import "./Dashboard.css";
import { useDispatch, useSelector } from "react-redux";
import { Layout, Col, Row, Space, message } from "antd";
import MeetingCard from "../components/MeetingCard";
import { HelpType, MeetingDetails } from "../types";
import SearchBar from "../components/SearchBar";
import SortButtonMeeting from "../components/SortButton";
import {
  fetchCurrentMeetings,
  selectOngoingMeetingsRetrieved,
  selectOngoingMeetingsIsLoading,
  selectOngoingMeetings,
  sortOngoingMeetings,
} from "../slices/meetingsSlice";
import LoadingSpinner from "components/LoadingSpinner";
import HelpButton from "components/HelpButton";

const { Content } = Layout;
export default function Dashboard() {
  const dispatch = useDispatch();
  const page = "dashboard";
  const meetings: MeetingDetails[] = useSelector(selectOngoingMeetings);
  const loading: boolean = useSelector(selectOngoingMeetingsIsLoading);
  const meetingsRetrieved: boolean = useSelector(selectOngoingMeetingsRetrieved);

  useEffect(() => {
    if (!meetingsRetrieved) {
      fetchMeetings();
    }
  }, [meetingsRetrieved]);

  async function fetchMeetings() {
    try {
        dispatch(fetchCurrentMeetings());
        dispatch(sortOngoingMeetings());
        // TODO error handling
        message.success("Meetings fetched!");
    } catch (err) {
        message.error({
            content: `An error occurred during fetch meetings. ${err}`,
            centered: true,
        }); // temp solution
    }
}

  if (loading || !meetingsRetrieved) {
    return <LoadingSpinner />;
  }

  return (
    <Layout className="site-layout">
      <div
        className="site-layout-background header-text"
        style={{ padding: 10, paddingLeft: 25 }}
      >
        Ongoing Meetings
      </div>
      <Content style={{ margin: "0", paddingLeft: 50, paddingRight: 50 }}>
        <Space direction="vertical" style={{width: "100%"}}>
        <Space size="large" style={{alignContent:"space-between"}}>
          <Space>
            <SearchBar page={page} />
            <SortButtonMeeting page={page} />
          </Space>
          <HelpButton type={HelpType.Dashboard}/>
        </Space>
        <Row
          className="row-style"
          gutter={[24, 20]}
        >
          {meetings &&
            meetings.map((meeting: MeetingDetails, key) => (
              <Col key={key}>
                <MeetingCard meeting={meeting} fromDashboard={true} />
              </Col>
            ))}
        </Row>
        </Space>
      </Content>
    </Layout>
  );
}
