// /Routes/applicationRoutes.js
const router = require('express').Router();
const protect = require('../middlewares/protect');
const {create,list,getOne,approve,reject,pay,checkIn,complete} = require('../Controllers/applicationController');
const {createApplicationValidator,approveValidator,rejectValidator,payValidator,checkInValidator,completeValidator,handleValidation,} = require('../utils/validators/applicationValidator');
const verifyRole = require('../utils/verifyRole');

// Create application (student & landlord)
router.post('/', protect, verifyRole('student', 'landlord'), createApplicationValidator, handleValidation, create);

// List applications (student: own, landlord: by own properties, admin: all)
router.get('/', protect, verifyRole('student', 'landlord', 'admin', 'super_admin', 'manager'), list);

// Get one application
router.get('/:id', protect, verifyRole('student', 'landlord', 'admin', 'super_admin', 'manager'), getOne);

// Approve/Reject (admin only)
router.patch('/:id/approve', protect, verifyRole('admin', 'super_admin'), approveValidator, handleValidation, approve);
  router.patch('/:id/reject', protect, verifyRole('admin', 'super_admin'), rejectValidator, handleValidation, reject);

// Pay (applicant)
router.patch('/:id/pay', protect, verifyRole('student', 'landlord'), payValidator, handleValidation, pay);

// Check-in (applicant)
router.patch('/:id/checkin', protect, verifyRole('student', 'landlord'), checkInValidator, handleValidation, checkIn);

// Complete (admin)
  router.patch('/:id/complete', protect, verifyRole('admin', 'super_admin'), completeValidator, handleValidation, complete);

module.exports = router;
