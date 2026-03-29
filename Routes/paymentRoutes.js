const router = require('express').Router();

const protect = require('../middlewares/protect');
const verifyRole = require('../utils/verifyRole');
const {
  listPayments,
  markPaymentReceived,
  markPaymentReleased,
} = require('../Controllers/paymentController');

// List payments (landlord: own; admin: all)
router.get('/', protect, verifyRole('landlord', 'admin'), listPayments);

// Admin/support actions (support role not present yet; admin only for now)
router.patch('/:id/receive', protect, verifyRole('admin'), markPaymentReceived);
router.patch('/:id/release', protect, verifyRole('admin'), markPaymentReleased);

module.exports = router;
