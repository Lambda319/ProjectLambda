import React, { useEffect, useState } from "react";
import { Button, Space } from "antd";
import { Layout } from "antd";
import {
  fetchFavourites,
  selectFavourites,
  selectFavouritesRetrieved,
  selectIsLoadingFavourites,
  deleteFavourite,
  selectSelectedRowKeysTable,
  selectOriginFavourites,
} from "../slices/favouritesSlice";
import SearchBar from "../components/SearchBar";
import SortButton from "components/SortButton";
import CallButton from "components/CallButton";
import AddMembersModal from "components/AddMembersModal";
import { DeleteOutlined } from "@ant-design/icons";
import FavouriteTable from "components/FavouriteTable";
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
const { Content } = Layout; 

export default function Favourites() {
  const dispatch = useDispatch();
  const selectedRowKeysTable = useSelector(selectSelectedRowKeysTable);
  const page = "favourites";
  const unfilteredFavourites: MemberDetails[] = useSelector(selectOriginFavourites);
  const favourites: MemberDetails[] = useSelector(selectFavourites);
  const users: UserDetails[] = useSelector(selectUsers);
  const isLoadingFavourites: boolean = useSelector(selectIsLoadingFavourites);
  const isLoadingUsers: boolean = useSelector(selectIsLoadingUsers);
  const favouritesRetrieved: boolean = useSelector(selectFavouritesRetrieved);
  const usersRetrieved: boolean = useSelector(selectUsersRetrieved);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleOk = () => {
    dispatch(deleteFavourite(selectedRowKeysTable));
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  useEffect(() => {
    if (!favouritesRetrieved) {
      dispatch(fetchFavourites());
    }

    if (!usersRetrieved) {
      dispatch(fetchUsersExceptSelf());
    }
  }, [favouritesRetrieved, usersRetrieved]);

  if (
    isLoadingFavourites ||
    isLoadingUsers ||
    !usersRetrieved ||
    !favouritesRetrieved
  ) {
    return <LoadingSpinner />;
  }

  const nonFriendedUsers: UserDetails[] = users.filter(
    (user1) => !unfilteredFavourites?.find((user2) => user1.email == user2.email)
  );
    return (
      <Layout className="site-layout">
        <DeleteConfirmationModal
          handleOk={handleOk}
          handleCancel={handleCancel}
          isModalVisible={isModalVisible}
          text={
            "Are you sure you want to delete this user from your favourites list?"
          }
        />
        <div
          className="site-layout-background header-text"
          style={{ padding: 10, paddingLeft: 25, marginBottom: 10 }}
        >
          Favourites
        </div>
        <Content style={{ margin: "0", paddingLeft: 50 }}>
            <Space size="large" style={{marginBottom: 10}}>
              <Space>
              <CallButton />
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
              <HelpButton type={HelpType.Favourites}/>
              <AddMembersModal users={nonFriendedUsers} isGroup={false} />
              </Space>
            <FavouriteTable favourites={favourites} />
        </Content>
      </Layout>
    );
}
