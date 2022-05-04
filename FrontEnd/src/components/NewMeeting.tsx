import { DatePicker, Form, Input, Modal, Select, Tooltip } from "antd";
import { UserDetails } from "../types";
import React, { useEffect, useState } from "react";
import "../card.css";
import { useSelector } from "react-redux";
import { createMeeting, isCreateMeetingModalOpen } from "slices/meetingsSlice";
import * as moment from "moment";
import { fetchUsersExceptSelf, selectIsLoadingUsers, selectUsers, selectUsersRetrieved } from "slices/usersSlice";
import { unwrapResult } from "@reduxjs/toolkit";
import { useAppDispatch } from "store";
const { Option } = Select;

export default function NewMeeting(): JSX.Element {
    const [form] = Form.useForm();
    const [invitees, setInvitees] = useState<string[]>([]);
    const [startTime, setStartTime] = useState<moment.Moment>(round(moment().add(5, 'minute')));
    const [endTime, setEndTime] = useState<moment.Moment>(round(moment().add(5, 'minute').add(1, 'hour')));
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
    });

    function handleSubmit(){
        form.validateFields().then(async values => {
            setConfirmLoading(true);
            try {
                const result = await dispatch(createMeeting({
                    title: values.title,
                    start_time: round(values.start).unix() * 1000,
                    end_time: round(values.end).unix() * 1000,
                    invitees: values.invitees?.map(function(element) {
                        return {email: element};
                    }) ?? [],
                }));
                const originalPromiseResult = unwrapResult(result);
                setConfirmLoading(false);
                if (!originalPromiseResult) { // payload is undefined for errors; not robust, but temporary solution until error handling is done
                    console.log(originalPromiseResult);
                    Modal.error({ content: `An error occurred during create meeting.`, maskClosable: true });
                } else {
                    form.resetFields();
                    const modal = Modal.success({
                        closable: true,
                        maskClosable: true,
                        content:
                            <p> Success!
                                <br />
                                Meeting Title: {values.title} <br />
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
                        okText: "Start Meeting",
                        onOk: () => {
                            modal.destroy();
                            window.open(originalPromiseResult.join_url, "_blank");
                            dispatch({
                                type: "meetings/openCreateMeetingModal",
                                payload: false
                            })},
                    });
                }
            } catch (err) {
                setConfirmLoading(false);
                Modal.error({
                    content: `An error occurred during create meeting. ${err}`,
                    centered: true,
                    maskClosable: true,
                }); // temp solution
                console.error("Failed to submit meeting:", err);
            }
        }).catch(info => console.log("Validate failed:", info));
    }

    function handleSelectChange (selectedItems) {
        setInvitees(selectedItems);
    }

    function onStartTimeChange(date) {
        setStartTime(date);
    }

    function onEndTimeChange(date) {
        setEndTime(date);
    }

    function disabledDate(current) { // https://github.com/ant-design/ant-design/issues/5146
        return current && current < moment().startOf('day');
    }

    function startTimeValidator() {
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

    function endTimeValidator() {
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

    function getDefaultStartDate(){
        return round(moment().add(5, 'minute'))
    }

    function getDefaultEndDate(){
        return round(moment().add(5, 'minute').add(1, 'hour'))
    }

    function round(date){
        return moment(date).minute(Math.round(date.minute() / 5) * 5);
    }

    const filteredOptions: UserDetails[] = users ? Object.values(users).filter((o: UserDetails) => !invitees?.includes(o?.email)) : users;
    return (
        <Modal
            title="Create a new meeting"
            visible={useSelector(isCreateMeetingModalOpen)}
            onOk={handleSubmit}
            onCancel={() => {
                form.resetFields();
                dispatch({
                    type: "meetings/openCreateMeetingModal",
                    payload: false
                });
            }
            }
            centered
            okText="Create meeting"
            confirmLoading={confirmLoading}
            maskClosable={false}
        >
            <Form
                form={form}
                name="form_in_modal"
                layout="vertical"
            >
                <Form.Item
                    name="title"
                    label="Meeting Title"
                    rules={[{required: true, message: "Please input the meeting title!"}]}
                >
                    <Input placeholder="Add meeting title..."/>
                </Form.Item>
                <Tooltip title="Times will be rounded to the nearest 5 minute increment." placement="left">
                <Form.Item name="start" label="Start Time"
                           rules={[{required:true, message:"Please input a start time!"}, { validator: startTimeValidator}]}
                           initialValue={getDefaultStartDate()}
                           dependencies={["end"]}
                >
                    <DatePicker
                        showTime
                        format={'YYYY-MM-DD, h:mm a'}
                        style={{width: 300}}
                        disabledDate={disabledDate}
                        allowClear
                        onChange={onStartTimeChange}
                        minuteStep={5}
                        value={startTime}
                        placeholder="Select start time..."
                    />
                </Form.Item>
                </Tooltip>
                <Tooltip title="Times will be rounded to the nearest 5 minute increment." placement="left">
                <Form.Item name="end" label="End Time"
                           rules={[{required:true, message:"Please input an end time!"}, { validator: endTimeValidator}]}
                           initialValue={getDefaultEndDate()}
                           dependencies={["start"]}
                >
                    <DatePicker
                        showTime
                        format={'YYYY-MM-DD, h:mm a'}
                        style={{width: 300}}
                        disabledDate={disabledDate}
                        allowClear
                        minuteStep={5}
                        onChange={onEndTimeChange}
                        value={endTime}
                        placeholder="Select end time..."
                    />
                </Form.Item>
                </Tooltip>
                <Tooltip placement="bottom" trigger="focus" visible={tooltipVisible} title="Begin typing to filter invitees.">
                    <Form.Item name="invitees" label="Invitees">
                        <Select
                            mode="multiple"
                            allowClear
                            style={{width: '100%'}}
                            placeholder="Add invitees..."
                            onChange={handleSelectChange}
                            optionLabelProp="label"
                            optionFilterProp="label"
                            value={invitees}
                            loading={loadingUsers}
                            onSearch={(string) => setTooltipVisible(string?.length < 1)}
                            onBlur={() => setTooltipVisible(false)}
                            onFocus={() => setTooltipVisible(true)}
                            maxTagCount={10}
                            maxTagPlaceholder={<Tooltip title={invitees.filter((value, index) => index > 9).join("\n")}>
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