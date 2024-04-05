const express = require("express");

const morgan = require("morgan"); //HTTP request logger middleware for node.js

const rateLimit = require("express-rate-limit"); //rate-limiting middleware for APIs

const helmet = require("helmet"); // automatically sets headers for security purposes to responses

const mongosanitize = require("express-mongo-sanitize"); //sanitize the data to prevent any scripts by user on forms to alter the data records

const bodyParser = require("body-parser"); //to parse any request body that we get before handled by any handler

const xss = require("xss"); //to filter requests in case user sends malicious scripts: Cross site scripting to prevent XSS attacks

const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    credentials: true //access control allow to let front-end see TLS certificates, cookies, etc
  })
);

app.use(express.json({ limit: "10kb" })); // by default, it is 100kb
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(helmet());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  max: 3000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, Please try again in an hour",
}); //to prevent bots from sending quick requests to API
// so we limit the no. of requests an IP can send in a particular timeframe

app.use("/tawk", limiter);

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(mongosanitize());

app.use((req, res, next) => {
  req.body = xss(req.body);
  next();
});
module.exports = app;
