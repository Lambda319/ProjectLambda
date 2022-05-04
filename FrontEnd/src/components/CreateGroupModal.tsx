import { Form, Input, message, Modal, Select } from "antd";
import React, { useState } from "react";
import "../card.css";
import { useSelector } from "react-redux";

import { unwrapResult } from "@reduxjs/toolkit";
import { useAppDispatch } from "store";
import { closeCreateGroupModal, createGroup, isCreateGroupModalOpen, refreshGroups } from "slices/groupSlice";

export default function CreateGroupModal(): JSX.Element {
    const [form] = Form.useForm();
    const [confirmLoading, setConfirmLoading] = useState<boolean>(false);
    const dispatch = useAppDispatch();


    function handleSubmit(){
        form.validateFields().then(async values => {
            setConfirmLoading(true);
            try {
                const result = await dispatch(createGroup({name: values.title}));
                const originalPromiseResult = unwrapResult(result);
                setConfirmLoading(false);
                if (!originalPromiseResult) { // payload is undefined for errors; not robust, but temporary solution until error handling is done
                    console.log(originalPromiseResult);
                    message.error({ content: `An error occurred during create meeting.` });
                } else {
                    form.resetFields();
                    message.success(`Created group: ${values.title}`);
                    dispatch(closeCreateGroupModal());
                    dispatch(refreshGroups());
                }
            } catch (err) {
                setConfirmLoading(false);
                message.error(`An error occurred during create group. ${err}`);
                console.error("Failed to submit group:", err);
            }
        }).catch(info => console.log("Validate failed:", info));
    }

    return (
        <Modal
            title="Create a new group"
            visible={useSelector(isCreateGroupModalOpen)}
            onOk={handleSubmit}
            onCancel={() => {
                form.resetFields();
                dispatch(closeCreateGroupModal());
                }
            }
            centered
            okText="Create group"
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
                    label="Group name"
                    rules={[{required: true, message: "Please input the group name!"}]}
                >
                    <Input placeholder="Add group name..."/>
                </Form.Item>
            </Form>
        </Modal>
    );
}