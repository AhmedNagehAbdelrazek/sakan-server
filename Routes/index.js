const router = require('express').Router();
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const activitiesRoutes = require('./activitiesRoutes');
const propertiesRoutes = require('./propertyRoutes');
const applicationRoutes = require('./applicationRoutes');
const flatmateRequestRoutes = require('./flatmateRequestRoutes');
const paymentRoutes = require('./paymentRoutes');
const adminDashboardRoutes = require('./adminDashboardRoutes');
const housingNeedRequestRoutes = require('./housingNeedRequestRoutes');

router.use("/auth",authRoutes);
router.use("/user",userRoutes);
router.use("/activities", activitiesRoutes);
router.use("/properties", propertiesRoutes);
router.use("/applications", applicationRoutes);
router.use("/flatmate-requests", flatmateRequestRoutes);
router.use("/housing-requests", housingNeedRequestRoutes);
router.use("/payments", paymentRoutes);
router.use("/admin", adminDashboardRoutes);


module.exports = router;