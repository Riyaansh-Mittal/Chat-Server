const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");

const User = require("../models/user");
const filterObj = require("../utils/filterObj");

const signToken = (userID) => jwt.sign({ userID }, process.env.JWT_SECRET);

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

}

exports.forgotPassword = async (req, res, next) => {
  // 1) get user email
  const

};

exports.resetPassword = async (req, res, next) => {

};


