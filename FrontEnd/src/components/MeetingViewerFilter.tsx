import { DatePicker, Form, Modal } from "antd";
import React from "react";
import "../card.css";
import { fetchMeetingsInRange, isCreateMeetingModalOpen } from "slices/meetingsSlice";
import * as moment from "moment";
import { useAppDispatch } from "store";

export default function MeetingViewerFilter({
  onSubmit,
  initialStart,
  initialEnd,
} : {
  onSubmit: (start, end) => void,
  initialStart: moment.Moment,
  initialEnd: moment.Moment,
}): JSX.Element {
 const [form] = Form.useForm();
  
 function handleSubmit(){
  form.validateFields().then((values) => onSubmit( values.start.unix() * 1000, values.end.unix() * 1000) 
  ).catch(info => console.log("Validate failed:", info));
}

function startTimeValidator(_, value) {
  
  const startTime = value;
  const endTime = form.getFieldValue("end");

  if (!startTime || !endTime) {
    return Promise.resolve();
  }

  if (startTime.isBefore(endTime))
    return Promise.resolve();

  return Promise.reject(new Error("Start date must be before end date"));
}

function endTimeValidator(_, value) {
  const startTime = form.getFieldValue("start");
  const endTime = value;

  if (!startTime || !endTime) {
    return Promise.resolve();
  }

  if (endTime.isAfter(startTime))
    return Promise.resolve();

  return Promise.reject(new Error("End date must be after start date"));
}

 return (
      <Form 
        form={form}
        name="form_in_modal"
        layout="inline"
        initialValues={{start: initialStart, end: initialEnd}}
        >
          <Form.Item name="start" label="Start Date"
           rules={[{required:true, message:"Please input a start date!"}, { validator: startTimeValidator}]}
           dependencies={["end"]}
          >
            <DatePicker
              format={'YYYY-MM-DD'} 
              style={{width: 300}} 
              allowClear 
              onChange={handleSubmit} 
              placeholder="Select start date..."
            />
          </Form.Item>
          <Form.Item name="end" label="End Date"
            rules={[{required:true, message:"Please input an end date!"}, { validator: endTimeValidator}]}
            dependencies={["start"]}
          >
           <DatePicker 
              format={'YYYY-MM-DD'} 
              style={{width: 300}} 
              allowClear
              onChange={handleSubmit} 
              placeholder="Select end date..."
          />
          </Form.Item>
      </Form>
  );
}