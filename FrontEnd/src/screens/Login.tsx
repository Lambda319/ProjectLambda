import { Button } from "antd";
import { LoginOutlined } from "@ant-design/icons";
import React from "react";
import "./Login.css";
import logo from "../assets/Lambda319Logo.png";
import { zoomLoginUrl } from "common";

const Login = (): JSX.Element => {
  const authenticate = () => {
    window.location.href = zoomLoginUrl;
  };

  return (
    <>
      <div className="login-background"></div>
      <img className="login-logo" src={logo} alt="Login Logo" />
      <h1 className="title">Project Lambda</h1>
      <Button
        className="button-center-round"
        onClick={authenticate}
        type="primary"
        size={"large"}
        icon={<LoginOutlined />}
      >
        Login
      </Button>
    </>
  );
};

export default Login;
