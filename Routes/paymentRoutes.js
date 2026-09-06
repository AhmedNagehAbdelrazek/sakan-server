const router = require('express').Router();

const protect = require('../middlewares/protect');
const verifyRole = require('../utils/verifyRole');
const {
  listPayments,
  markPaymentReceived,
  markPaymentReleased,
  markPaymentRefunded,
} = require('../Controllers/paymentController');
const { refundValidator, handleValidation } = require('../utils/validators/refundValidator');

// List payments (landlord: own; admin/manager: all)
router.get('/', protect, verifyRole('landlord', 'admin', 'super_admin', 'manager'), listPayments);

// Admin/support actions (admin/super_admin only; verifyRole auto-allows super_admin)
router.patch('/:id/receive', protect, verifyRole('admin', 'super_admin'), markPaymentReceived);
router.patch('/:id/release', protect, verifyRole('admin', 'super_admin'), markPaymentReleased);
router.patch('/:id/refund', protect, verifyRole('admin', 'super_admin'), refundValidator, handleValidation, markPaymentRefunded);

module.exports = router;
