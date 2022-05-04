import { Table, Tag } from "antd";
import { MemberDetails } from "../types";
import React from "react";
import "../table.css";
import { useDispatch, useSelector } from "react-redux";
import { selectSelectedRowKeysTable } from "../slices/favouritesSlice";
import useWindowDimensions from "common";
import { updateSelectedRowKeysTable } from "slices/groupSlice";

export default function MembersTable({
  members,
}: {
  members: MemberDetails[];
}): JSX.Element {
  const dispatch = useDispatch();

  function onSelectChange(selectedRowKeysTable) {
    dispatch(updateSelectedRowKeysTable(selectedRowKeysTable));
  }

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Status",
      key: "is_online",
      dataIndex: "is_online",
      render: (is_online, current_meeting) => {
        let color = is_online === 1 ? "geekblue" : "volcano";
        if (current_meeting.current_meeting !== null) {
          color = "purple";
        }

        let online_status = is_online === 1 ? "online" : "offline";
        if (current_meeting.current_meeting !== null) {
          online_status = "in-meeting";
        }
        return (
          <Tag color={color} key={is_online}>
            {online_status}
          </Tag>
        );
      },
    },
    {
      title: "Location",
      key: "current_meeting",
      dataIndex: "current_meeting",
      render: (current_meeting) => {
        const color = current_meeting === null ? "volcano" : "geekblue";
        const user_location = current_meeting === null ? " " : current_meeting;
        return (
          <Tag color={color} key={current_meeting}>
            {user_location}
          </Tag>
        );
      },
    },
  ];

  const selectedRowKeysTable = useSelector(selectSelectedRowKeysTable);
  const rowSelection = {
    selectedRowKeysTable,
    onChange: onSelectChange,
    getCheckboxProps: (record: MemberDetails) => ({
      disabled: record.name === "Disabled User", // Column configuration not to be checked
      name: record.name,
    }),
  };
  
  return (
    <Table
      rowKey="email"
      style={{ paddingRight: 50, paddingBottom: 20, overflowY: "hidden" }}
      pagination={false}
      scroll={{ x: 0, y: Math.floor(useWindowDimensions().height / 1.3) }}
      rowSelection={{
        type: "checkbox",
        preserveSelectedRowKeys: true,
        ...rowSelection,
      }}
      columns={columns}
      dataSource={members}
    />
  );
}
