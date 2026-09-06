
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const { signin_roles } = require("../config/constants.js");
const authService = require("../Services/authService.js");
const User = require("../Models/user.js");

// =========== Controllers ============

exports.SignUp = asyncHandler(async (req, res, next) => {
  const { username, email, role, password, phone } = req.body;
  if (!username || !password || !phone || !role || !email) {
    return next(new ApiError("All fields are required", 400));
  }

  // validate role from the signin_roles
  if(!signin_roles.includes(role)){
    return next(new ApiError(`Invalid role the role should be on of [${signin_roles.join(" - ")}]`, 400));
  }
  await authService.checkUserDoesNotExists({username, email, phone});

  // OTP verification is disabled: the account is created verified and a token is returned right away
  const user = await authService.register(req.body);
  const token = await authService.signToken(user.id);

  res.status(201).json({
    message: "Registration successful",
    user,
    role: user.role,
    token,
  });
});

exports.sendOTP = asyncHandler(async (req, res) => {
  let userId = req.userId;

  if (!userId) {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return new ApiError("User not found", 404);
    }
    userId = user.id;
  }

  await authService.sendOTP(userId);

  res.status(200).json({
    message: "The verify code Sent to your Email",
  });
});

exports.verifyOTP = asyncHandler(async (req, res) => {
  // verify OTP and update user record accordingly
  const { email, otp } = req.body;

  const result = await authService.verifyOTP(email, otp);

  res.status(200).json({
    message: "OTP verified successfully",
    ...result,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await authService.login(email, password);

  return res.status(200).json({ ...result });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.forgotPassword(email);

  res.status(200).json({
    status: "success",
    message: "Password reset OTP sent to your email and phone",
  });
});

exports.verifyPasswordResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const result = await authService.verifyPasswordResetOtp(email, otp);

  res.status(200).json({
    status: "success",
    message: "OTP verified successfully",
    ...result,
  });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  //get the new password and the user by Token
  const resetToken = req.query.token || req.body.resetToken;
  const { password } = req.body;
  const result = await authService.resetPassword(resetToken, password);

  return res.status(200).json({
    status: "success",
    message: "Password Reseted successfully",
    ...result,
  });
});
