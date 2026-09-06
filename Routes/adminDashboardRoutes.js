const router = require('express').Router();

const protect = require('../middlewares/protect');
const verifyRole = require('../utils/verifyRole');
const { dashboardQueryValidator, handleValidation } = require('../utils/validators/dashboardValidator');
const { getDashboard } = require('../Controllers/adminDashboardController');
const { broadcast } = require('../Controllers/notificationController');
const { broadcastValidator } = require('../utils/validators/broadcastValidator');

router.get('/dashboard', protect, verifyRole('admin', 'super_admin', 'manager'), dashboardQueryValidator, handleValidation, getDashboard);
router.post('/broadcast', protect, verifyRole('admin', 'super_admin'), broadcastValidator, handleValidation, broadcast);

module.exports = router;
