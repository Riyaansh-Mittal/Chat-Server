const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const User = require("../models/user");
const filterObj = require("../utils/filterObj");
const crypto = require("crypto");
const { promisify } = require("util");

const signToken = (userID) => jwt.sign({ userID }, process.env.JWT_SECRET);

// Signup => register - sentOTP - verifyOTP

// https://api.tawk.com/auth/register

//Register New User
exports.register = async (req, res, next) => {
  const { firstName, lastName, email, password, verified } = req.body;

  const filterBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "password",
    "email"
  ); //to make sure that if any user manipulates the request body to add any other field, it's not used

  //check if a verified user with given email exists
  const existing_user = findOne({ email: email });

  if (existing_user && existing_user.verified) {
    res.status(400).json({
      status: "error",
      message: "Email is already in use. Please login",
    });
  } else if (existing_user) {
    await User.findOneAndUpdate(
      { email: email },
      filterBody,
      { new: true }, //so this new entry and new id, not the old the
      { validateModifiedOnly: true } //so that validations in fields run only if those particular fields are updated, else not
    );

    //generate OTP and send email to user
    req.userId = existing_user._id; //add new id to request body before sending to next controller or middleware
    next();
  } else {
    //if user record is not available in DB
    const newUser = await User.create(filterBody);

    //generate OTP and send user to email
    req.userId = newUser._id; //add new id to request body before sending to next controller or middleware
    next();
  }
};

exports.sendOTP = async (req, res, next) => {
  const { userId } = req.body;
  const new_otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

  const otp_expiry_time = Date.now() + 10 * 60 * 1000; // 10 minutes after oto is sent

  await User.findByIdAndUpdate(userId, {
    otp: new_otp,
    otp_expiry_time,
  });

  // TODO Send Email
  res.status(200).json({
    status: "success",
    message: "OTP Sent Successfully",
  });
};

exports.verifyOTP = async (req, res, next) => {
  //verify OTP and update user record successfully

  const { email, otp } = req.body;
  const user = await User.findOne({
    email,
    otp_expiry_time: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400).json({
      status: "error",
      message: "Email is invalid or OTP expired",
    });
  }

  if (!(await user.correctOTP(otp, user.otp))) {
    res.status(400).json({
      status: "error",
      message: "OTP is incorrect",
    });
  }

  //OTP is correct
  user.verified = true;
  user.otp = undefined;
  await user.save({ new: true }, { validateModifiedOnly: true });

  const token = signToken(user._id);

  res.status.json({
    status: "success",
    message: "OTP verified successfully!",
  });
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({
      status: "error",
      message: "Both email and password are required",
    });
  }
  const userDoc = await User.findOne({ email: email }).select("+password"); //to also fetch password with email
  if (!userDoc || (await userDoc.correctPassword(password, userDoc.password))) {
    res.status(400).json({
      status: "error",
      message: "Email or password is incorrect",
    });
  }

  const token = signToken(userDoc._id);

  res.status.json({
    status: "success",
    message: "Logged in successfully",
  });
};

exports.protect = async (req, res, next) => {
  // 1) Getting a token (JWT) and check if it's actually there
  let token;
  //'Bearer kjhfdjkcbdkjxcbbsceggcfbeis'
  if(req.headers.authorization && req.headers.authorization.startsWith("Bearer")){
    token = req.hears.authorization.split(" ")[1];

  } else if(req.cookies.jwt){
    token = req.cookies.jwt;
  } else{
    req.status(400).json({
      status: "error",
      message: "You are not logged In! Please log in to get access"
    });
  }

  // 2) verification of token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET); //example of a Higher-Order function

  // 3) Check if user still exists
  const this_user = await User.findById(decoded.userID);

  if(!this_user){
    res.status(400).json({
      status: "error",
      message: "The user doesn't exist"
    })
  }

  // 4) check if user changed their password after token was issued
  // Edge case: a user logs in at 10:15
  // At 10:20 another person who has the login details resets password
  // so the user who logged in at 10:15 shouldn't be able to send any requests
  if(this_user.changedPasswordAfter(decoded.iat)){
    res.status(400).json({
      status: "error",
      message: "User recently updated password! Please log in again"
    })
  }
  req.user = this_user;
  next();
};
// TYpes of routes => Protected (Only Logged in users can access these) & unProtected

exports.forgotPassword = async (req, res, next) => {
  // 1) get user email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return res.status(400).json({
      status: "error",
      message: "There is no user with given email address",
    });
  }

  // 2) Generate random reset token
  const resetToken = user.createPasswordResetToken();

  const resetURL = `https://tawk.com/auth/reset-password/?code=${resetToken}`;

  try {
    // TODO => Send Email With Reset URL
    res.status(200).json({
      status: "success",
      message: "Reset Password link sent to Email",
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false }); //we are passing undefined which is not a valid value

    //500 for server-side error
    //400 for client-side error
    res.status(500).json({
      status: "error",
      message: "There was an error sending the email, please try again later",
    });
  }

  // https: // ?code=njdkcndjk this code is the reset token
};

exports.resetPassword = async (req, res, next) => {
  // 1) Get the user based on Token

  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has expired pr submission is out of time window
  // there can be a case when this user value could be undefined bcoz of 2 reasons =>
  //1: when user manipulates token from client's side
  //2: user is out of 10 minutes time window

  if (!user) {
    res.status(400).json({
      status: 400,
      message: "Token is Invalid or Expired",
    });
  }

  // 3) Update user's password and set resetToken & expiry to undefined
  user.password = req.body.password;
  user.passwordConfirm = req.body.conformPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // 4) Log in the user and Send new JWT
  const token = signToken(user._id);

  // TODO => Send an emial to suer informing about password change

  res.status.json({
    status: "success",
    message: "Password Reseted Successfully",
  });
};
