import { Button, Tooltip } from "antd";
import { UserAddOutlined } from "@ant-design/icons";
import React from "react";
import PropTypes from "prop-types";
import { useDispatch} from "react-redux";


OpenAddMembersModalButton.propTypes = {
  deleteFavourite: PropTypes.func,
};

export default function OpenAddMembersModalButton() {
  const dispatch = useDispatch();
  return (
    <Tooltip title="Add">
      <Button
        className={"add"}
        style={{ fontFamily: "Aleo" }}
        icon={<UserAddOutlined />}
        onClick={() => {
          dispatch({
            type: "favourites/openAddMembersModal",
            payload: true
          });
        }}
      >
        Add Members
      </Button>
    </Tooltip>
  );
}
