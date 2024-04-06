const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First Name is requires"],
  },
  lastName: {
    type: String,
    required: [true, "Last Name is requires"],
  },
  avatar: {
    type: String,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    validate: {
      validator: function (email) {
        return String(email)
          .toLowerCase()
          .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
          );
      },
      message: (props) => `Email (${props.value}) is invalid`,
    },
    password: {
      type: String,
    },
    passwordConfirm: {
      type: String,
    },
    passwordChangedAt: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    createdAt: {
      type: Date,
    },
    updatedAt: {
      type: Date,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: Number,
    },
    otp_expiry_time: {
      type: Date,
    },
  },
});

userSchema.pre("save", async function (next) {
  //only run this fnx if OTP is modified
  if (!this.isModified("otp")) return next();

  //Hash the otp with the cost of 12
  this.otp = await bcrypt.hash(this.otp, 12);
  next();
});
userSchema.pre("save", async function (next) {
  //only run this fnx if password is modified
  if (!this.isModified("password")) return next();

  //Hash the password with the cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};
userSchema.methods.correctOTP = async function (candidateOTP, userOTP) {
  return await bcrypt.compare(candidateOTP, userOTP);
};

userSchema.methods.createPasswordResetToken = function () {
  //we are not using arrow function as arrow functions don't have 'this' keyword
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10*60*1000;

  return resetToken;
};

userSchema.methods.passwordChangedAfter = function(timestamp){
  return timestamp > this.passwordChangedAt
}

const User = new mongoose.model("User", userSchema);
module.exports = User;
