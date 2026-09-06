const { SignUp, sendOTP, verifyOTP, forgotPassword, verifyPasswordResetOtp, resetPassword } = require('../Controllers/authController');
const { login } = require("../Controllers/authController");
const { loginValidator, verifyResetOtpValidator, resetPasswordValidator } = require("../utils/validators/authValidator");
const router = require("express").Router();

router.post("/register", SignUp);
router.post("/sendOtp", sendOTP);
router.post("/login", loginValidator, login);
router.post("/verfiyOtp", verifyOTP);
router.post("/forgotpassword", forgotPassword);
router.post("/verifyResetOtp", verifyResetOtpValidator, verifyPasswordResetOtp);
router.post("/resetpassword", resetPasswordValidator, resetPassword);

module.exports = router;
