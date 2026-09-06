const { getAllUsers, getMe, getUserById, updateUser } = require("../Controllers/userController");
const protect = require('../middlewares/protect');
const { listUsersValidator, updateUserValidator, handleValidation } = require('../utils/validators/userValidator');
const { getpreferneces, updatePreferences } = require('../Controllers/userPreferenecsController');
const { getUserActivities, getUserActivity, logUserActivity } = require('../Controllers/activitiesController');
const verifyRole = require("../utils/verifyRole");
const { getUserProfile, updateUserProfile } = require("../Controllers/userProfileController");
const notificationRoutes = require('./notificationRoutes');
const router = require("express").Router();


router.get("/",protect,verifyRole('admin','super_admin','manager'), listUsersValidator, handleValidation, getAllUsers);
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

// notifications history routes
router.use('/notifications', notificationRoutes);

// admin single-user views (after specific routes to avoid shadowing /me, /preferences, /profile)
router.get("/:id", protect, verifyRole('admin','super_admin','manager'), getUserById);
router.patch("/:id", protect, verifyRole('admin','super_admin'), updateUserValidator, handleValidation, updateUser);

module.exports = router;


