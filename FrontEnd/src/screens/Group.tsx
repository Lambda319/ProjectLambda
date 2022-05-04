import React, { useEffect, useState } from "react";
import { Button, message, Popconfirm, Space, Tooltip } from "antd";
import { Layout } from "antd";
import SearchBar from "../components/SearchBar";
import SortButton from "components/SortButton";
import AddMembersModal from "components/AddMembersModal";
import { DeleteOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import LoadingSpinner from "components/LoadingSpinner";
import OpenAddMembersModalButton from "components/OpenAddMembersModalButton";
import {
  fetchUsersExceptSelf,
  selectUsers,
  selectUsersRetrieved,
  selectIsLoadingUsers,
} from "../slices/usersSlice";
import DeleteConfirmationModal from "components/DeleteConfirmationModal";
import { UserDetails, MemberDetails, HelpType } from "types";
import HelpButton from "components/HelpButton";
import {
  deleteMember,
  fetchCurrentGroupMembers,
  selectGroupRetrieved, 
  selectMembers, 
  selectOriginMembers,
  selectIsLoadingMembers,
  selectSelectedRowKeysTable,
  selectCurrentGroupName,
  deleteGroup,
  refreshGroups,
} from "../slices/groupSlice";
import CallButtonGroup from "components/CallButtonGroup";
import MembersTable from "components/MembersTable";
import { useAppDispatch } from "store";
const { Content } = Layout; 

export default function Group() {
  const dispatch = useAppDispatch();
  const selectedRowKeysTable = useSelector(selectSelectedRowKeysTable);
  const page = "group";
  const unfilteredMembers: MemberDetails[] = useSelector(selectOriginMembers);
  const members: MemberDetails[] = useSelector(selectMembers);
  const users: UserDetails[] = useSelector(selectUsers);
  const isLoadingMembers: boolean = useSelector(selectIsLoadingMembers);
  const isLoadingUsers: boolean = useSelector(selectIsLoadingUsers);
  const membersRetrieved: boolean = useSelector(selectGroupRetrieved);
  const usersRetrieved: boolean = useSelector(selectUsersRetrieved);
  const groupName: string = useSelector(selectCurrentGroupName);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleOk = () => {
    dispatch(deleteMember(selectedRowKeysTable));
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  useEffect(() => {
    if (!membersRetrieved) {
      dispatch(fetchCurrentGroupMembers());
    }

    if (!usersRetrieved) {
      dispatch(fetchUsersExceptSelf());
    }
  }, [membersRetrieved, usersRetrieved]);

  if (
    isLoadingMembers ||
    isLoadingUsers ||
    !usersRetrieved ||
    !membersRetrieved
  ) {
    return <LoadingSpinner />;
  }


  const nonFriendedUsers: UserDetails[] = users.filter(
    (user1) => !unfilteredMembers?.find((user2) => user1.email == user2.email)
  );
    return (
      <Layout className="site-layout">
        <DeleteConfirmationModal
          handleOk={handleOk}
          handleCancel={handleCancel}
          isModalVisible={isModalVisible}
          text={
            "Are you sure you want to delete this user from your group?"
          }
        />
        <div
          className="site-layout-background header-text"
          style={{ padding: 10, paddingLeft: 25, marginBottom: 10 }}
        >
          {groupName}
        </div>
        <Content style={{ margin: "0", paddingLeft: 50 }}>
            <Space size="large" style={{marginBottom: 10}}>
              <Space>
              <CallButtonGroup/>
              <OpenAddMembersModalButton />
              <Button
                className="delete"
                style={{ fontFamily: "Aleo" }}
                icon={<DeleteOutlined />}
                onClick={() => setIsModalVisible(true)}
                disabled={selectedRowKeysTable.length === 0}
              >
                Delete Selected
              </Button>
              </Space>
              <SearchBar page={page} />
              <SortButton page={page} />
              <HelpButton type={HelpType.Favourites}/> {/* TODO help page */}
              <Popconfirm
                title="Are you sure you want to delete the group?"
                onConfirm={async () => {
                  try {
                    dispatch(deleteGroup());
                    message.success(`Group deleted.`); 
                  } catch {
                    message.error("There was an error deleting the group.");
                  }
                  dispatch(refreshGroups());
                }}
              >
                <Tooltip title="Delete group">
                <Button shape="circle"><DeleteOutlined /></Button>
                </Tooltip>
              </Popconfirm>
              <AddMembersModal users={nonFriendedUsers} isGroup={true} />
              </Space>
            <MembersTable members={members} />
        </Content>
      </Layout>
    );
}
