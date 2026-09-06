const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.loginValidator = [
  check("email")
    .notEmpty()
    .withMessage("email is required")
    .isEmail()
    .withMessage("provide a valid email"),
  check("password").notEmpty().withMessage("password is required"),
  validatorMiddleware,
];

exports.verifyResetOtpValidator = [
  check("email")
    .notEmpty()
    .withMessage("email is required")
    .isEmail()
    .withMessage("provide a valid email"),
  check("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),
  validatorMiddleware,
];

exports.resetPasswordValidator = [
  check("resetToken")
    .notEmpty()
    .withMessage("reset token is required"),
  check("password")
    .notEmpty()
    .withMessage("password is required")
    .isLength({ min: 6 })
    .withMessage("password must be at least 6 characters"),
  validatorMiddleware,
];
