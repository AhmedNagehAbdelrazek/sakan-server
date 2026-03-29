// /Routes/applicationRoutes.js
const router = require('express').Router();
const protect = require('../middlewares/protect');
const {create,list,getOne,approve,reject,pay,checkIn,complete} = require('../Controllers/applicationController');
const {createApplicationValidator,approveValidator,rejectValidator,payValidator,checkInValidator,completeValidator,handleValidation,} = require('../utils/validators/applicationValidator');
const verifyRole = require('../utils/verifyRole');

// Create application (student)
router.post('/', protect, verifyRole('student'), createApplicationValidator, handleValidation, create);

// List applications (student: own, landlord: by own properties, admin: all)
router.get('/', protect, verifyRole('student', 'landlord', 'admin'), list);

// Get one application
router.get('/:id', protect, verifyRole('student', 'landlord', 'admin'), getOne);

// Approve/Reject (admin only)
router.patch('/:id/approve', protect, verifyRole('admin'), approveValidator, handleValidation, approve);
router.patch('/:id/reject', protect, verifyRole('admin'), rejectValidator, handleValidation, reject);

// Pay (student)
router.patch('/:id/pay', protect, verifyRole('student'), payValidator, handleValidation, pay);

// Check-in (student)
router.patch('/:id/checkin', protect, verifyRole('student'), checkInValidator, handleValidation, checkIn);

// Complete (admin)
router.patch('/:id/complete', protect, verifyRole('admin'), completeValidator, handleValidation, complete);

module.exports = router;
