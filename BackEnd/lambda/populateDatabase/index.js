const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'lambda-db.ccm7hsk2434c.us-west-2.rds.amazonaws.com', // endpoint from AWS RDS 
    user: 'masterUsername', // mySQL username
    password: 'masterpassword', // mySQL password
    database: 'Data-1' // Our database name as on MySql community
});

connection.connect((err) => {
    if (err) {
        console.log('Error connecting to Db');
        return;
    }
    console.log('Connection established');
});

function GeneralQuery(inputQuery, values = []) {
    const params = {
        sql: inputQuery,
        values: values
    };
    console.log("General Query : ", inputQuery);
    const query = buildQuery(params);
    return new Promise((resolve, reject) => {
        connection.query(query, (error, result) => {
            if (error) {
                console.log(error);
                return reject(error);
            }
            return resolve(result);
        });
    });
}

function SelectAllElementsFromUser() {
    const params = {
        sql: "SELECT * FROM User",
        values: []
    };
    const query = buildQuery(params);
    return new Promise((resolve, reject) => {
        connection.query(query, (error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

function SelectAllElementsFromManager() {
    const params = {
        sql: "SELECT * FROM Manager",
        values: []
    };
    const query = buildQuery(params);
    return new Promise((resolve, reject) => {
        connection.query(query, (error, result) => {
            if (error) {
                return reject(error);
            }
            return resolve(result);
        });
    });
}

function buildQuery(params) {
    let query = {
        sql: params.sql,
        timeout: 400000,
        values: params.values
    };
    console.log("building query");
    return query;
}

exports.handler = async (event) => {
    console.log(event);

    try {
        let data = JSON.parse(event.body);
        // let Userdata = await SelectAllElementsFromUser();
        // console.log(Userdata);
        // let Managerdata = await SelectAllElementsFromManager();
        // console.log(Managerdata);
        //
        let user_length = data.User.length;
        let manager_length = data.Manager.length;
        // ID 0
        // For clearing database
        await GeneralQuery("DELETE FROM `Data-1`.`GroupMember`");
        await GeneralQuery("DELETE FROM `Data-1`.`Group`;");
        await GeneralQuery("DELETE FROM `Data-1`.`GroupOwner`");
        await GeneralQuery("DELETE FROM `Data-1`.`Manager`");
        await GeneralQuery("DELETE FROM `Data-1`.`MeetingParticipant`");
        await GeneralQuery("DELETE FROM `Data-1`.`UserStatus`");
        await GeneralQuery("DELETE FROM `Data-1`.`Meeting`");
        await GeneralQuery("DELETE FROM User");

        // ID 1
        // For adding dummy data for the User table
        await GeneralQuery("ALTER TABLE `Data-1`.`Group` AUTO_INCREMENT = 1");
        console.log("reset group number count");
        for (let i = 0; i < user_length; i++) {
            await GeneralQuery(
                `INSERT INTO User (Email, FName, LName) VALUES (?, ?, ?)`,
                [data["User"][i]["Email"], data["User"][i]["FName"], data["User"][i]["LName"]]);
            await GeneralQuery(
                `INSERT INTO UserStatus(Email, MeetingLocation, IsOnline) VALUES (?, ?, ?)`,
                [data["User"][i]["Email"], null, 0]);

            await GeneralQuery("INSERT INTO `Data-1`.`Group` (Name, isFavorite) VALUES('Fav', true)");
            await GeneralQuery(`INSERT INTO GroupOwner (GroupID, OwnerEmail) VALUES (?, ?)`,
                [i + 1, data["User"][i]["Email"]]);

        }
        console.log("inserted into user, userstatus, group, and groupowner for all users");


        let Userdata = await SelectAllElementsFromUser();

        // // ID 2
        // For adding the dummy data for Manager table
        for (let i = 0; i < manager_length; i++) {
            await GeneralQuery(`INSERT INTO Manager (ManagerEmail, EmployeeEmail) VALUES ( ? , ? )`,
                [data["Manager"][i]["ManagerEmail"], data["Manager"][i]["EmployeeEmail"]]);
        }
        let Managerdata = await SelectAllElementsFromManager();

        console.log("inserted into manager");

        const response = {
            "statusCode": 200,
            "error": 0,
            "message": "Successfully Updated Database",
            // "body" : {
            //     "data" : {
            //         "Userdata" : JSON.stringify(Userdata),
            //         "Managerdata" : JSON.stringify(Managerdata)
            //     }
            // }
        };
        return response;
    } catch (err) {
        console.log("error encountered");
        console.log(JSON.stringify(err.stack));
        const response = {
            "statusCode": 400,
            "error": 1,
            "message": "Failed to Upload Database",
            "body": {
                "data": JSON.stringify(err.stack)
            }
        };
        return response;
    }
};
