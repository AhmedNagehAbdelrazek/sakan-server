
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const { signin_roles } = require("../config/constants.js");
const authService = require("../Services/authService.js");

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

  try {
    const user = await authService.register({username, email, role, password, phone});
    req.userId = user.id;
    next();
  } catch (err) {
    return next(new ApiError(`${err.message}`, 500));
  }
});

exports.sendOTP = asyncHandler(async (req, res) => {
  const { userId } = req;

  await authService.sendOTP(userId);

  res.status(200).json({
    message: "The verify code Sent to your Email",
  });
});

exports.verifyOTP = asyncHandler(async (req, res) => {
  // verify OTP and update user record accordingly
  const { email, otp } = req.body;

  const token = await authService.verifyOTP(email, otp);

  res.status(200).json({
    message: "OTP verified successfully",
    token,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const token = await authService.login(email, password);

  return res.status(200).json({ token });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  //get user email
  const { email } = req.body;
  await authService.forgotPassword(email);

  res.status(200).json({
    status: "success",
    message: "Reset Password link sent to email",
});
});

exports.resetPassword = asyncHandler(async (req, res) => {
  //get the new password and the user by Token
  const resetToken = req.query.token || req.body.token;
  const { password } = req.body;
  const token = await authService.resetPassword(resetToken, password);

  return res.status(200).json({
    status: "success",
    message: "Password Reseted successfully",
    token,
  });
});
