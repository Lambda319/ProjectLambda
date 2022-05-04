const AWS = require("aws-sdk");
AWS.config.region = "us-west-2";
const lambda = new AWS.Lambda();

exports.handler = async (event, context, callback) => {
    const auth_token = event["queryStringParameters"]["code"];
    console.log(`auth_token: ${auth_token}`);
    console.log(event);
    console.log(context);
    console.log(callback);

    const payload = {
        name: "GET_ACCESS_TOKEN",
        body: {
            authToken: auth_token,
            redirectUri: `${process.env.REDIRECT_URI}`,
            clientId: `${process.env.CLIENT_ID}`,
            clientSecret: `${process.env.CLIENT_SECRET}`
        },
    };

    const params = {
        FunctionName: "ZoomAdapter",
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(payload),
    };

    try {
        let response = await lambda.invoke(params).promise();
        response = JSON.parse(response.Payload);
        const access_token = response.body.accessToken;
        const refresh_token = response.body.refreshToken;
        console.log(`accessToken: ${access_token}`);
        console.log(`refreshToken: ${refresh_token}`);
        return {
            statusCode: 302,
            headers: {
                Location: `${process.env.URI}?access_token=${access_token}&refresh_token=${refresh_token}`,
            },
        };
    } catch (err) {
        console.log(err);
    }
};
