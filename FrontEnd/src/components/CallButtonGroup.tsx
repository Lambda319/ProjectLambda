import { Button, Modal } from "antd";
import { PhoneOutlined } from "@ant-design/icons";
import { unwrapResult } from "@reduxjs/toolkit";
import { createInstantMeeting } from "slices/meetingsSlice";
import store, { useAppDispatch } from "../store";
import React, {useState} from "react";
import { useSelector } from "react-redux";
import { selectLoggedInUsersName } from "slices/usersSlice";

store.subscribe(listener);
store.subscribe(listener2);
let currentValue : string[] = [];
let allValue : string[] = [];


function selectCurrent(state) {
  return state.group.selectedRowKeysTable;
}

function selectAll(state) {
  if (state.group.members !== null) {
    return state.group.members.map(fav => {
      return fav.email;
    });
  } else return [];
}

function listener() {
  currentValue = selectCurrent(store.getState())
  return currentValue;
}

function listener2() {
  allValue = selectAll(store.getState())
  return allValue;
}

export default function CallButtonGroup(): JSX.Element {
  const loggedInUsersName: string = useSelector(selectLoggedInUsersName);
  const [isLoading,setLoading ] = useState({loading : false});
  const dispatch = useAppDispatch();
  const instantMeetingTime = new Date();

  async function handleSubmit(values){

    setLoading({loading : true})
    try {
      const result = await dispatch(createInstantMeeting({
        name: loggedInUsersName,
        date: instantMeetingTime.toLocaleTimeString('en-US'),
        start_time: Date.now(),
        invitees: values?.map(function(element) {
          return {email: element};
        }) ?? [isLoading],
      }));
      const originalPromiseResult = unwrapResult(result);
      if (!originalPromiseResult) { // payload is undefined for errors; not robust, but temporary solution until error handling is done
        console.log(originalPromiseResult);
      } else {

        setLoading({loading : false})
        window.open(originalPromiseResult.join_url, "_blank");
        const modal = Modal.success({
          closable: true,
          maskClosable: true,
          content:
              <p> Success!
                <br />
                Meeting Title: {originalPromiseResult.title} <br />
                Meeting ID: {originalPromiseResult.meeting_id} <br />
                Password: {originalPromiseResult.password}
              </p>,
          centered: true,
          onCancel: () => {
            modal.destroy();
            dispatch({
              type: "meetings/openCreateMeetingModal",
              payload: false
            })},
          okText: "Join Meeting",
          onOk: () => {
            window.open(originalPromiseResult.join_url, "_blank");
            modal.destroy();
            dispatch({
              type: "meetings/openCreateMeetingModal",
              payload: false
            })},
        });
      }
    } catch (err) {
      Modal.error({
        content: `An error occurred during create meeting. ${err}`,
        centered: true,
      }); // temp solution
      console.error("Failed to submit meeting:", err);
    }
  }

  if (currentValue.length !== 0) {
    return (
        <Button
            className={"call"}
            style={{ fontFamily: "Aleo" }}
            icon={<PhoneOutlined />}
            loading={isLoading.loading}
            onClick={
              () => {
                handleSubmit(currentValue)
              }
            }
        >
          Call Selected
        </Button>
    );
  } else return (
      <Button
          className={"call"}
          style={{ fontFamily: "Aleo" }}
          icon={<PhoneOutlined />}
          loading={isLoading.loading}
          onClick={
            () => {
              handleSubmit(allValue)
            }
          }
      >
        Call All
      </Button>
  );
}
