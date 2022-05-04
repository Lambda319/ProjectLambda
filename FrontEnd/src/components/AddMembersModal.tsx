import { Button, Tooltip, Modal, Input, Table, Select, Space, message } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import React, { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { UserDetails } from "types";
import {
  addFavourite,
  isAddMembersModalOpened,
} from "slices/favouritesSlice";
import { addMember } from "slices/groupSlice";
const { Option } = Select;


AddMembersModal.propTypes = {
  addFavourite: PropTypes.func,
};

export default function AddMembersModal({
  users,
  isGroup,
}: {
  users: UserDetails[];
  isGroup: boolean;
}): JSX.Element {
  const dispatch = useDispatch();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState("name");
  
  function onSelectChange(selectedRowKeys) {
    setSelectedRowKeys(selectedRowKeys);
  }

  const rowSelection = {
    selectedRowKeysModal: selectedRowKeys,
    onChange: onSelectChange,
    getCheckboxProps: (record: UserDetails) => ({
      disabled: record.name === "Disabled User", // Column configuration not to be checked
      name: record.name,
    }),
  };
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
  ];
  return (
    <>
      <Tooltip title="Add"></Tooltip>
      <Modal
        title="Add Members"
        visible={useSelector(isAddMembersModalOpened)}
        onOk={() => {
          dispatch({ type: "favourites/openAddMembersModal", payload: false });
        }}
        onCancel={() => {
          dispatch({ type: "favourites/openAddMembersModal", payload: false });
        }}
        width={700}
        footer={[
          <Button
            key="cancel"
            onClick={() =>
              dispatch({
                type: "favourites/openAddMembersModal",
                payload: false,
              })
            }
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            disabled={selectedRowKeys.length < 1}
            onClick={async () => {
              try {
              isGroup ? dispatch(addMember(selectedRowKeys)) : dispatch(addFavourite(selectedRowKeys));
              dispatch({
                type: "favourites/openAddMembersModal",
                payload: false,
              });
                message.success(`Successfully added members: ${selectedRowKeys}`)
              } catch (err) {
                message.error(`Error adding members: ${err}.`);
              }
            }}
          >
            Add
          </Button>,
        ]}
      >
        {
          <Space direction="vertical">
            <Space>
              <Input
                placeholder="Search Employees"
                style={{ width: 200 }}
                prefix={<SearchOutlined/>}
                onChange={ (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              />
              <Select onSelect={(value: string) => setSearchType(value)} defaultValue="name">
                <Option value="name">Search by: Name</Option>
                <Option value="email">Search by: Email</Option>
              </Select>
            </Space>
            <Table
              rowKey="email"
              style={{
                overflowY: "hidden",
              }}
              rowSelection={{
                type: "checkbox",
                preserveSelectedRowKeys: true,
                ...rowSelection,
              }}
              columns={columns}
              dataSource={users.filter((user: UserDetails) => user[searchType].toLowerCase().startsWith(search))}
              size="small"
              pagination={false}
              scroll={{ y: 400 }}
            />
          </Space>
        }
      </Modal>
    </>
  );
}
