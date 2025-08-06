const router = require('express').Router();
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const activitiesRoutes = require('./activitiesRoutes');

router.use("/auth",authRoutes);
router.use("/user",userRoutes);
router.use("/activities", activitiesRoutes);


module.exports = router;