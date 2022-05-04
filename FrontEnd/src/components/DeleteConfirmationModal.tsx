import React from "react";
import { Modal } from "antd";
import PropTypes from "prop-types";

DeleteConfirmationModal.propTypes = {
  handleOk: PropTypes.func,
  handleCancel: PropTypes.func,
  isModalVisible: PropTypes.bool,
  text: PropTypes.string,
};

export default function DeleteConfirmationModal({
  handleOk,
  handleCancel,
  isModalVisible,
  text,
}: {
  handleOk: () => void;
  handleCancel: () => void;
  isModalVisible: boolean;
  text: string;
}): JSX.Element {
  return (
    <Modal
      title="Delete Favourites"
      visible={isModalVisible}
      onOk={handleOk}
      onCancel={handleCancel}
    >
      <p>{text}</p>
    </Modal>
  );
}
