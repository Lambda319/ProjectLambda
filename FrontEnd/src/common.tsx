import axios from "axios";
import { useEffect, useState } from "react";

export enum errorMessage {
  ZOOM_ERROR = "Zoom API error. Please try again later",
  TOKEN_ERROR = "Access token is no longer valid. Please login again",
  INVALID_REQUEST_ERROR = "Invalid request or invalid email",
}

export const zoomLoginUrl = `https://zoom.us/oauth/authorize?client_id=${process.env.REACT_APP_CLIENT_ID}&response_type=code&redirect_uri=${process.env.REACT_APP_REDIRECT_URL}`;

export const updateCookies = (response) => {
  if (response.data && response.data.headers) {
    if (response.data.headers["SEt-Cookie"]) {
      document.cookie = `access_token=${response.data.headers[
        "SEt-Cookie"
      ].substring(7)}; path=/home; Secure`;
    }

    if (response.data.headers["Set-Cookie"]) {
      document.cookie = `refresh_token=${response.data.headers[
        "Set-Cookie"
      ].substring(8)}; path=/home; Secure`;
    }
  }
};

export const errorHandling = (errorCode: number) => {
  if (errorCode != 0) {
    if (errorCode == 2) {
      alert(errorMessage.TOKEN_ERROR);
      window.location.href = zoomLoginUrl;
    } else if (errorCode == 4) {
      alert(errorMessage.INVALID_REQUEST_ERROR);
    } else if (errorCode == 1) {
      alert(errorMessage.ZOOM_ERROR);
    }
  }
};

export const getCookieValue = (name) =>
  document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)")?.pop() || "";

export function getClientWithEmailHeader(url: string) {
  const client = axios.create({
    baseURL: url,
    headers: {
      email: getCookieValue("email"),
      user: getCookieValue("email"),
      access_token: getCookieValue("access_token"),
      refresh_token: getCookieValue("refresh_token"),
    },
  });
  return client;
}

export function getClientWithNoEmailHeader(url: string) {
  const client = axios.create({
    baseURL: url,
    headers: {
      user: getCookieValue("email"),
      access_token: getCookieValue("access_token"),
      refresh_token: getCookieValue("refresh_token"),
    },
  });
  return client;
}

function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = window;
  return {
    width,
    height
  };
}

export default function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowDimensions;
}
