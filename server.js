const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
dotenv.config({ path: "config.env" });

process.on("uncaughtException", (err) => {
  console.log(err);
  process.exit(1);
});

const http = require("http");

const server = http.createServer(app);

const DB = process.env.DBURI.replace("<password>", process.env.DBPASSWORD);

mongoose
  .connect(
    DB
    //   , { // all the below features are now default after mongoose version 6
    //   useNewUrlParser: true, //there is a mongoDB driver which has deprecated the current url parser. So mongoose provides this flag so we can fllback to old url parser if there's bug in new parser
    //   useCreateIndex: true, //MongoDB used an ensure index function which was used to ensure that indexes exist, or else new one was created. This was deprecated in createIndex method so we pass this useCreateIndex to ensure that we use new function introduces
    //   useFindAndModify: false, //previous method used in MongoDB. But we use findandupdate, findbyIDandupdate, etc
    //   useUnifiedTopology: true, //to ensure that we use new MongoDB engine, to use MongoDB new driver connection management engine
    // }
  )
  .then((con) => {
    console.log("DB connection is successful");
  })
  .catch((err) => {
    console.log(err);
  });

const port = process.env.PORT || 8000;

server.listen(port, () => {
  console.log(`App running on port ${port}`);
});

process.on("unhandledRejection", (err) => {
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});
