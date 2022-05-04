import { DatePicker, Form, Input, Modal, Select, Tooltip } from "antd";
import { MeetingDetails, Participant, UserDetails } from "../types";
import React, { useEffect, useState } from "react";
import "../card.css";
import { useSelector } from "react-redux";
import { closeEditMeetingModal, editMeeting, isEditMeetingModalOpen, selectEditingMeeting } from "slices/meetingsSlice";
import * as moment from "moment";
import { fetchUsersExceptSelf, selectIsLoadingUsers, selectUsers, selectUsersRetrieved } from "slices/usersSlice";
import { unwrapResult } from "@reduxjs/toolkit";
import { useAppDispatch } from "store";
import { getCookieValue } from "common";
const { Option } = Select;

export default function EditMeeting() : JSX.Element {
 const [form] = Form.useForm();
 const meeting: MeetingDetails = useSelector(selectEditingMeeting);
 const [invitees, setInvitees] = useState<string[]>();
 const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
 const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
 const dispatch = useAppDispatch();
 const users: UserDetails[] = useSelector(selectUsers);
 const loadingUsers: boolean = useSelector(selectIsLoadingUsers);
 const usersRetrieved: boolean = useSelector(selectUsersRetrieved);
 useEffect(() => {
   if (!usersRetrieved) {
      dispatch(fetchUsersExceptSelf());
   }
   setInvitees(form.getFieldValue("invitees"));
 }), [meeting];

function handleSubmit(){
  form.validateFields().then(async values => {
    setConfirmLoading(true);
    try {
      const result = await dispatch(editMeeting({
        title: values.title,
        start_time: values.start.unix() * 1000,
        end_time: values.end.unix() * 1000,
        invitees: values.invitees?.map(function(element) {
          return {email: element};
        }) ?? [],
        meeting_id: meeting.id,
      }));
      const originalPromiseResult = unwrapResult(result);
      setConfirmLoading(false);
      if (!originalPromiseResult) { // payload is undefined for errors; not robust, but temporary solution until error handling is done
          console.log(originalPromiseResult);
          Modal.error({ content: `An error occurred during edit meeting.` });
      } else {
        const modal = Modal.success({
          closable: true,
          maskClosable: true,
          content: <p>Join URL:&nbsp;<br /><a href={originalPromiseResult.join_url} target="_blank" rel="noreferrer">{originalPromiseResult.join_url}</a><br />
            Meeting ID: {originalPromiseResult.id} <br />
            Password: {originalPromiseResult.password}</p>,
          centered: true,
          onCancel: () => {
            modal.destroy();
            form.resetFields();
            dispatch(closeEditMeetingModal());
          },
          onOk: () => {
            modal.destroy();
            form.resetFields();
            dispatch(closeEditMeetingModal());
          },
        });
      }
    } catch (err) {
      setConfirmLoading(false);
      Modal.error({ 
        content: `An error occurred during edit meeting. ${err}`,
        centered: true,
      }); // temp solution
      console.error("Failed to submit meeting:", err);
    }
  }).catch(info => console.log("Validate failed:", info));
}
 
 function handleSelectChange (selectedItems) {
    setInvitees(selectedItems);
 }

 function disabledDate(current) { // https://github.com/ant-design/ant-design/issues/5146
  return current && current < moment().startOf('day');
 }

function startTimeValidator(_, value) {
  
  const startTime = value;
  const endTime = form.getFieldValue("end");

  if (startTime?.isBefore(moment())) {
    return Promise.reject(new Error("Start time must be in the future"));
  }
  if (!startTime || !endTime) {
    return Promise.resolve();
  }

  if (startTime.isBefore(endTime))
    return Promise.resolve();

  return Promise.reject(new Error("Start time must be before end time"));
}

function endTimeValidator(_, value) {
  const startTime = form.getFieldValue("start");
  const endTime = value;

  if (endTime?.isBefore(moment())) {
    return Promise.reject(new Error("End time must be in the future"));
  }

  if (!startTime || !endTime) {
    return Promise.resolve();
  }

  if (endTime.isAfter(startTime))
    return Promise.resolve();

  return Promise.reject(new Error("End time must be after start time"));
}

 const filteredOptions: UserDetails[] = users ? Object.values(users).filter((o: UserDetails) => !invitees?.includes(o?.email)) : users;
 return (
    <Modal 
      title="Edit meeting" 
      visible={useSelector(isEditMeetingModalOpen)} 
      onOk={handleSubmit} 
      destroyOnClose
      onCancel={() => {
        form.resetFields();
        dispatch(closeEditMeetingModal());
        }
      }
      centered
      okText="Edit meeting"
      confirmLoading={confirmLoading}
      maskClosable={false}
    >
      <Form 
        form={form}
        name="form_in_modal"
        layout="vertical"
        preserve={false}
        >
          <Form.Item
            name="title"
            label="Meeting Title"
            rules={[{required: true, message: "Please input the meeting title!"}]}
            initialValue={meeting?.title} 
          >
           <Input placeholder="Add meeting title..." />
          </Form.Item>
          <Form.Item name="start" label="Start Time"
           rules={[{required:true, message:"Please input a start time!"}, { validator: startTimeValidator}]}
           dependencies={["end"]}
           initialValue={meeting ? moment(meeting.start_time) : undefined}
          >
            <DatePicker
              showTime
              format={'MMMM Do YYYY, h:mm a'} 
              style={{width: 300}} 
              disabledDate={disabledDate}
              allowClear 
              placeholder="Select start time..."
            />
          </Form.Item>
          <Form.Item name="end" label="End Time"
            rules={[{required:true, message:"Please input an end time!"}, { validator: endTimeValidator}]}
            dependencies={["start"]}
            initialValue={meeting ? moment(meeting.end_time) : undefined}
          >
           <DatePicker 
              showTime
              format={'MMMM Do YYYY, h:mm a'} 
              style={{width: 300}} 
              disabledDate={disabledDate}
              allowClear
              placeholder="Select end time..."
          />
          </Form.Item>
            <Tooltip placement="bottom" trigger="focus" visible={tooltipVisible} title="Begin typing to filter invitees.">
              <Form.Item name="invitees" label="Invitees" initialValue={meeting?.participants.filter((member) => member.email !== getCookieValue("email")).map((participant: Participant) => participant.email)}>
                <Select
                  mode="multiple"
                  allowClear
                  style={{width: '100%'}}
                  placeholder="Add invitees..."
                  onChange={handleSelectChange}
                  optionLabelProp="label"
                  optionFilterProp="label"
                  loading={loadingUsers}
                  onSearch={(string) => setTooltipVisible(string?.length < 1)}
                  onBlur={() => setTooltipVisible(false)}
                  onFocus={() => setTooltipVisible(true)}
                  maxTagCount={10}
                  maxTagPlaceholder={<Tooltip title={invitees?.filter((value, index) => index > 9).join("\n")} 
                  >
                    + more...
                  </Tooltip>
                  }
                >
                  {filteredOptions?.map((user: UserDetails, key) => (
                    <Option value={user.email} label={user.name} key={key}>
                        {user.name} ({user.email})
                    </Option>
                  ))}
              </Select>
            </Form.Item>
          </Tooltip>
      </Form>
    </Modal>
  );
}