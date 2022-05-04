import React, { useEffect, useState } from "react";
import "./Settings.css";
import Papa from "papaparse";
import axios from "axios";

const Settings = (): JSX.Element => {
  const [userTable, setUserTable] = useState<any>(null);
  const [managerTable, setManagerTable] = useState<any>(null);

  const parseAndUpload = async () => {
    if (userTable !== null && managerTable !== null) {
      const dataToUpload = {};

      dataToUpload["User"] = userTable;
      dataToUpload["Manager"] = managerTable;

      const client = axios.create({
        baseURL:
          "https://cpa6s5u7uh.execute-api.us-west-2.amazonaws.com/v1/population",
      });

      try {
        const response = await client.post("/", {
          body: JSON.stringify(dataToUpload),
        });

        console.log(response);
      } catch (e) {
        console.log(e);
      }
    } else {
      console.log(
        "your user table and/or your manager table has not been uploaded."
      );
    }
  };

  const handleChange = (event, type: string) => {
    const files = event.target.files;
    if (files) {
      console.log(files[0]);
      Papa.parse(files[0], {
        header: true,
        dynamicTyping: true,
        complete: function (results) {
          if (type == "User") {
            setUserTable(results.data);
          } else if (type == "Manager") {
            setManagerTable(results.data);
          }
        },
      });
    }
  };

  return (
    <div className="vertical-center">
      <form onSubmit={parseAndUpload}>
        <label>STEP 1: Upload User Table in CSV Format </label>
        <input
          accept=".csv"
          onChange={(e) => handleChange(e, "User")}
          type="file"
        />

        <br></br>
        <label>STEP 2: Upload Manager Table in CSV Format </label>
        <input
          accept=".csv"
          onChange={(e) => handleChange(e, "Manager")}
          type="file"
        />
        <br></br>
        <div className="updateButton">
          <input type="submit" value="Update DB" />
        </div>
      </form>
    </div>
  );
};

export default Settings;
