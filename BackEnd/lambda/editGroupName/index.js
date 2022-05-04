const mysql = require('mysql');
const AWS = require("aws-sdk");
AWS.config.region = "us-west-2";

function connectToRDB() {
    const connection = mysql.createConnection({
        host: 'lambda-db.ccm7hsk2434c.us-west-2.rds.amazonaws.com', // endpoint from AWS RDS
        user: 'masterUsername', // mySQL username
        password: 'masterpassword', // mySQL password
        database: 'Data-1', // Our database name as on MySql community
    });

    let response = {
        connection: null,
        error: null
    };

    connection.connect((err) => {
        if (err) {
            response.error = err;
            console.log(err);
        }
        console.log("connection established");
    });
    response.connection = connection;
    return response;
}

function buildIsFavouriteGroupQuery(params) {
    let sql = "";
    let values = [];
    values.push(params.id);
    sql = "SELECT IsFavorite FROM `Data-1`.`Group` where id = ?";
    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };
    console.log(query);
    return query;
}

function builEditGroupNamedQuery(params) {

    let sql = "";
    let values = [params.name, params.id];
    sql = "UPDATE `Data-1`.`Group` Set Name = ? Where ID = ?;";
    console.log(sql);
    let query = {
        sql: sql,
        timeout: 40000,
        values: values
    };
    return query;
}

async function queryDB(connection, query) {
    return new Promise((resolve, reject) => {
        return connection.query(query, function (error, results, fields) {
            if (error) {
                return reject(error);
            }
            // You can get the number of changed rows from an update statement.
            console.log('changed ' + results.changedRows + ' rows');
            let response = {
                results: null,
                fields: null,
            };
            if (results) {
                response.results = results;
            }
            if (fields) {
                response.fields = fields;
            }
            return resolve(response);
        });
    });
}


function parseInput(request) {
    let tokens = {
        updated: false,
        access_token: request.headers.access_token,
        refresh_token: request.headers.refresh_token
    };


    let params = {
        tokens: tokens,
        id: request.body.group_id,
        name: request.body.group_name
    };
    return params;
}


function returnErr(errorCode, statusCode, errorMsg) {
    return {
        error: errorCode,
        msg: errorMsg,
        headers: {
            'statusCode': statusCode,
        },
    };
}

function buildErrorObject(params, queryResponse) {
    return {
        error: 1,
        msg: queryResponse.error, // error msg
        headers: {
            'statusCode': 400, // error code
            'SEt-Cookie': `access=${params.tokens.access_token}`, // Workaround for multiple cookies in AWS
            'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
        },
    };
}


/**
 *
 * @param event {group_id: "<group_id>", group_name: "<group_name>",  headers:{access_token, refresh_token}}
 * @returns {Promise<void>}
 */
exports.handler = async (event, context) => {

    if (!event.headers) {
        return returnErr(2, 400, `Missing headers for query: ${JSON.stringify(event)}`);
    }

    if (!event.headers.access_token || !event.headers.refresh_token) {
        return returnErr(2, 401, `Unauthorized: No tokens provided, err: ${JSON.stringify(event)}`);
    }
    if (!event.body) {
        return returnErr(2, 400, `Missing Body for query ${JSON.stringify(event)}`);
    }
    if (!event.body.group_id) {
        return returnErr(2, 400, `Missing Group ID for query ${JSON.stringify(event)}`);
    }
    if (!event.body.group_name) {
        return returnErr(2, 400, `Missing Group Name for query ${JSON.stringify(event)}`);
    }

    try {

        let dbConnectionResponse = connectToRDB();

        if (dbConnectionResponse.error !== null) {
            return returnErr(1, 500,
                `Error connecting to RDS DB. Reason: ${dbConnectionResponse.error}`);
        }

        let connection = dbConnectionResponse.connection;

        let params = parseInput(event);
        // For selecting/displaying isFavorite of group
        let query = buildIsFavouriteGroupQuery(params);
        let queryResponse;
        try {
            queryResponse = await queryDB(connection, query);
            if (queryResponse.results[0].IsFavorite === 1) {
                return returnErr(1, 400,
                    `Error: Favorite Group Cannot Be Updated: ${JSON.stringify(queryResponse.results[0])} for input ${JSON.stringify(event)}`);
            }
        } catch (err) {
            return buildErrorObject(params, err);
        }
        // For editing
        query = builEditGroupNamedQuery(params);
        try {
            queryResponse = await queryDB(connection, query);
        } catch (err) {
            return buildErrorObject(params, err);
        }
        connection.end();
        let response;
        response = {
            group_id: event.body.group_id,
            group_name: event.body.group_name
        };
        return {
            error: 0,
            msg: "Data Updated successfully",
            headers: {
                'statusCode': 200,
                'SEt-Cookie': `access=${params.tokens.access_token}`, //Workaround for multiple cookies in AWS
                'Set-Cookie': `refresh=${params.tokens.refresh_token}`,
            },
            body: response

        };
    } catch (err) {
        console.log(err);
        return returnErr(1, 500, JSON.stringify(err));
    }
};