const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
dotenv.config({ path: ".env" });

const { Server } = require("socket.io");

process.on("uncaughtException", (err) => {
  console.log(err);
  process.exit(1);
});

const http = require("http");
const User = require("./models/user");
const FriendRequest = require("./models/friendRequest");
const { use } = require("./routes");
const OneToOneMessage = require("./models/OneToOneMessage");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
}); //important for client and server-side connection

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

io.on("connection", async (socket) => {
  console.log(JSON.stringify(socket.handshake.query));
  console.log("/////////////////////////////////////////////////////////");
  console.log(socket);
  const user_id = socket.handshake.query["user_id"];

  const socket_id = socket.id; //get a unique socket id

  console.log(`User connected ${socket_id}`);

  if (Boolean(user_id)) {
    await User.findByIdAndUpdate(user_id, { socket_id });
  }
  //we can write our socket event listeners here ...

  socket.on("friend_request", async (data) => {
    console.log(data.to);

    //data => {to, from}

    const to_user = await User.findById(data.to).select("socket_id");
    const from_user = await User.findById(data.from).select("socket_id");

    //create a friend request

    await FriendRequest.create({
      sender: data.from,
      recipient: data.to,
    });

    //TODO => create a friend request
    // emit event => "new_friend_request"
    io.to(to_user.socket_id).emit("new_friend_request", {
      //
      message: "New Friend Request Received",
    });
    // emit event => "request_sent"
    io.to(from_user.socket_id).emit("request_sent", {
      message: "Request sent sucessfully!",
    });
  });

  socket.on("accept_request", async (data) => {
    console.log(data);

    const request_doc = await FriendRequest.findById(data.request_id);

    console.log(request_doc);

    //request_id

    const sender = await User.findById(request_doc.sender);
    const receiver = await User.findById(request_doc.recipient);

    sender.friends.push(request_doc.recipient);
    receiver.friends.push(request_doc.sender);

    await receiver.save({ new: true, validateModifiedOnly: true });
    await sender.save({ new: true, validateModifiedOnly: true });

    await FriendRequest.findByIdAndDelete(data.request_id);

    io.to(sender.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });
    io.to(receiver.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });
  });

  socket.on("get_direct_converstaions", async ({ user_id }, callback) => {
    const existing_conversations = await OneToOneMessage.find({
      participants: { $all: [user_id, socket.handshake.query.user_id] },
      // to get all the converstaions that I have ever had
    }).populate("participants", "firstName lastName _id email status");

    console.log(existing_conversations);

    callback(existing_conversations);
  });

  socket.on("start_conversation", async (data) => {
    // data: {to, from}
    const { to, from } = data;
    // check if there is any existing conversation between these users
    const existing_conversations = await OneToOneMessage.find({
      participants: { $size: 2, $all: [to, from] },
    }).populate("participants", "firstName lastName _id email status");

    console.log(existing_conversations[0], "Existing Conversation");

    // if no => create a new OneToOneMessage doc & emit event "start_chat" & send conversation details as payload
    if (existing_conversations.length === 0) {
      let new_chat = await OneToOneMessage.create({
        participants: [to, from],
      });

      new_chat = await OneToOneMessage.findById(new_chat).populate(
        "participants",
        "firstName lastName _id email status"
      );

      console.log(new_chat);

      socket.emit("start_chat", new_chat);
    }
    // if yes => just emit event "start_chat" & send conversation details as payload
    else {
      socket.emit("start_chat", existing_conversations[0]);
    }
  });

  socket.on("get_messages", async (data, callback) => {
    const { messages } = await OneToOneMessage.findById(
      data.conversation_id
    ).select("messages");

    callback(messages);
  });

  socket.on("text_message", async (data) => {
    console.log("Received Message", data);

    //data => {to, from, message, conversation_id, type}
    const { to, from, message, conversation_id, type } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    const new_message = {
      to,
      from,
      type,
      text: message,
      created_at: Date.now(),
    };

    // create a new conversation if it doesn't exist yet or add new message to the messages list
    const chat = await OneToOneMessage.findByIdAndUpdate(conversation_id);
    chat.messages.push(new_message);
    // save to db
    await chat.save({});

    //emit incoming_message => to user
    io.to(to_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });
    //emit outgoing_message => from user
    io.to(from_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });
  });

  socket.on("file_message", async (data) => {
    console.log("Received Message", data);

    //data => {to, from, text, file}

    //get the file extension
    const fileExtension = path.extname(data.file.name);

    // generate a unique filename
    const fileName = `file-${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}${fileExtension}`;

    // upload file to AWS s3

    // create a new conversation if it doesn't exist yet or add new message to the messages list

    // save to db

    //emit incoming_message => to user

    //emit outgoing_message => from user
  });

  socket.on("end", async (data) => {
    // Find user by _id and set the status to offline
    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, { status: "offline" });
    }

    // TODO => broadcast user_disconnected

    console.log("closing connection");
    socket.disconnect(0);
  });
}); //default event, when connection established between client and server

process.on("unhandledRejection", (err) => {
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});
