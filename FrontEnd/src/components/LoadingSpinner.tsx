import { Spin } from "antd";
import React from "react";

export default function LoadingSpinner(): JSX.Element {
  return (
    <div
      style={{
        marginTop: "200px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Spin size="large" />
    </div>
  );
}
