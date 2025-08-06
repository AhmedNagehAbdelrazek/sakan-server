const { getAllUsers, getMe } = require("../Controllers/userController");
const protect = require('../middlewares/protect');
const { getpreferneces, updatePreferences } = require('../Controllers/userPreferenecsController');
const { getUserActivities, getUserActivity, logUserActivity } = require('../Controllers/activitiesController');
const verifyRole = require("../utils/verifyRole");
const { getUserProfile, updateUserProfile } = require("../Controllers/userProfileController");
const router = require("express").Router();


router.get("/",protect,verifyRole(['admin']), getAllUsers);
router.get("/me",protect, getMe);

//user preferences routes
router.get("/preferences", protect, getpreferneces);
router.patch("/preferences", protect, updatePreferences);
// user activities routes
router.get('/activities',protect, getUserActivities);
router.get('/activities/:id',protect, getUserActivity);
router.post("/activities",protect,logUserActivity);
// user profile routes
router.get("/profile", protect, getUserProfile);
router.patch("/profile", protect, updateUserProfile);

module.exports = router;


