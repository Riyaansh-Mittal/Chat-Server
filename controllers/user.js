const User = require("../models/user");
const filterObj = require("../utils/filterObj");
const {FriendRequest} = require("../models/friendRequest")

exports.updateMe = async (req, res, next) => {
  const { user } = req;

  const filteredBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "about",
    "avatar"
  );

  const updated_user = await User.findByIdAndUpdate(user._id, filteredBody, {
    new: true,
    validateModifiedOnly: true,
  });

  res.status(200).json({
    status: "success",
    data: updated_user,
    message: "Profile Updated successfully",
  });
};

exports.getUsers = async (req, res, next) => {
  const all_users = await User.find({
    verified: true,
  }).select("firstName lastName _id"); //we want only these 3 fields of all verified users

  const this_user = req.user;

  const remaining_users = all_users.filter(
    (user) =>
      !this_user.friends.includes(user._id) &&
      user._id.toString() !== req.user._id.toString()
  ); //to make sure that request is made to those which are not in friends list of sender and not to self

  res.status(200).json({
    status: "success",
    data: remaining_users,
    message: "Users found successfully!",
  })
};

exports.getRequests = async (req, res, next) => {
  const requests = await FriendRequest.find({recepient: req.user_id}).populate("sender", "_id firstName lastName")
}

exports.getFriends = async (req, res, next) => {
  const friends = await User.findById(req.user_id).populate("friends", "_id firstName lastName"); //populate to get these 3 properties

  res.status(200).json({
    status: "success",
    message: "Friends Found Successfully"
  })
}
