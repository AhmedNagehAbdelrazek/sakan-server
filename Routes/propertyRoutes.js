const router = require('express').Router();
const protect = require('../middlewares/protect');
const upload = require('../middlewares/uploadMiddleware');
const {
	createProperty,
	listProperties,
	getProperty,
	updateProperty,
	deleteProperty,
	nearbyCount,
	uploadPropertyImage,
	getPropertyImage,
	submitProperty,
	approveProperty,
	declineProperty,
	reopenProperty,
} = require('../Controllers/propertyController');
const {
	createPropertyValidator,
	updatePropertyValidator,
	nearbyValidator,
	submitPropertyValidator,
	approvePropertyValidator,
	declinePropertyValidator,
	reopenPropertyValidator,
	propertyIdOnlyValidator,
	handleValidation,
} = require('../utils/validators/propertyValidator');
const verifyRole = require('../utils/verifyRole');

router.get('/image', getPropertyImage);
router.get('/nearby', protect, nearbyValidator, handleValidation, nearbyCount);
router.get('/', protect, verifyRole('admin', 'landlord', 'student'), listProperties);
router.post('/upload-image', protect, verifyRole('landlord'), upload.single('image'), uploadPropertyImage);
router.patch('/:id/submit', protect, verifyRole('landlord'), submitPropertyValidator, handleValidation, submitProperty);
router.patch('/:id/approve', protect, verifyRole('admin'), approvePropertyValidator, handleValidation, approveProperty);
router.patch('/:id/decline', protect, verifyRole('admin'), declinePropertyValidator, handleValidation, declineProperty);
router.patch('/:id/reopen', protect, verifyRole('admin'), reopenPropertyValidator, handleValidation, reopenProperty);

router.post('/', protect, verifyRole('landlord'), upload.array('images', 10), createPropertyValidator, handleValidation, createProperty);
router.get('/:id', protect, propertyIdOnlyValidator, handleValidation, getProperty);

router.patch('/:id', protect, verifyRole('admin', 'landlord'), updatePropertyValidator, handleValidation, updateProperty);
router.delete('/:id', protect, verifyRole('admin', 'landlord'), propertyIdOnlyValidator, handleValidation, deleteProperty);

module.exports = router;
