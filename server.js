const express = require("express");
const server = express();

server.use(express.static(`${__dirname}/public`));

server.get("/movies", getMovies)
server.post("/create", createDatabase)
server.delete("/delete", deleteDatabase)

const AWS = require('aws-sdk');
const s3 = new AWS.S3();

AWS.config.update({
  region: "eu-west-1",

});

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();


function createDatabase(req, res) {
  console.log("TEST");
  var getParams = {
    Bucket: 'csu44000assignment220', // your bucket name,
    Key: 'moviedata.json' // path to the object you're looking for
  }

  s3.getObject(getParams, function (err, data) {
    // Handle any error and exit
    if (err) {
      console.log(err);
      return err;
    }

    // No error happened
    // Convert Body from a Buffer to a String

    let objectData = data.Body.toString('utf-8'); // Use the encoding necessary
    let jsonData = JSON.parse(objectData);

    var params = {
      TableName: "Movies",
      KeySchema: [
        { AttributeName: "year", KeyType: "HASH" },  //Partition key
        { AttributeName: "title", KeyType: "RANGE" }  //Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: "year", AttributeType: "N" },
        { AttributeName: "title", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      }
    };

    dynamodb.createTable(params, function (err, data) {
      if (err) {
        console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));

        var params = {
          TableName: 'Movies' /* required */
        };
        dynamodb.waitFor('tableExists', params, function (err, data) {
          if (err) console.log(err, err.stack); // an error occurred
          else {
            jsonData.forEach(function (movie) {
              var params = {
                TableName: "Movies",
                Item: {
                  "year": movie.year,
                  "title": movie.title,
                  "rating": movie.info.rating
                }
              };

              docClient.put(params, function (err, data) {
                if (err) {
                  console.error("Unable to add movie", movie.title, ". Error JSON:", JSON.stringify(err, null, 2));
                } else {
                  console.log("PutItem succeeded:", movie.title);
                }
              });
            });
          }
        });
      }
    });
  });

};

//////////////////////////////////

function getMovies(req, res) {
  var params = {
    TableName: "Movies",
    KeyConditionExpression: "#yr = :yyyy and begins_with(title, :prefix)",
    FilterExpression: "rating between :rating and :maxValue",
    ExpressionAttributeNames: {
      "#yr": "year"
    },
    ExpressionAttributeValues: {
      ":yyyy": parseInt(req.query.year),
      ":prefix": req.query.title,
      ":rating": parseFloat(req.query.rating),
      ":maxValue": 10
    }
  };

  docClient.query(params, function (err, data) {
    if (err) {
      console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
    } else {
      console.log("Query succeeded.");
      data.Items.forEach(function (item) {
        console.log(" -", item.year + ": " + item.title);
      });
      res.json(data.Items);
    }
  });
};

//////////////////////////////////////////

function deleteDatabase(req, res) {
  var params = {
    TableName: "Movies"
  };

  dynamodb.deleteTable(params, function (err, data) {
    if (err) {
      console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
    }
  });
};

const PORT = 8080;

server.listen(PORT, function () {
  console.log(`Listening to port ${PORT}`);
});