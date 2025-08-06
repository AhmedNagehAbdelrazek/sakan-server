const expressAsyncHandler = require("express-async-handler");
const UserProfileService = require("../Services/userProfileService");

exports.getUserProfile = expressAsyncHandler(async (req, res) => {
  const user = req.user;

  const userProfile = await UserProfileService.getUserProfile(user.id);

  return res.status(200).json(userProfile);
});

exports.updateUserProfile = expressAsyncHandler(async (req, res) => {
  const user = req.user;

  const userProfile = await UserProfileService.updateUserProfile(user.id, req.body);

  return res.status(200).json(userProfile);
});
