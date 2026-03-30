const router = require('express').Router();

const protect = require('../middlewares/protect');
const verifyRole = require('../utils/verifyRole');
const { getDashboard } = require('../Controllers/adminDashboardController');

router.get('/dashboard', protect, verifyRole('admin'), getDashboard);

module.exports = router;
