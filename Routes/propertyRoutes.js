const router = require('express').Router();
const protect = require('../middlewares/protect');
const upload = require('../middlewares/uploadMiddleware');
const {createProperty,listProperties,getProperty,updateProperty,deleteProperty,nearbyCount,uploadPropertyImage,getPropertyImage} = require('../Controllers/propertyController');
const {createPropertyValidator,updatePropertyValidator,nearbyValidator,handleValidation} = require('../utils/validators/propertyValidator');
const verifyRole = require('../utils/verifyRole');

router.get('/image', getPropertyImage);
router.get('/nearby', protect, nearbyValidator, handleValidation, nearbyCount);
router.get('/', protect, verifyRole('admin', 'landlord', 'student'), listProperties);
router.post('/upload-image', protect, verifyRole('landlord'), upload.single('image'), uploadPropertyImage);

router.post('/', protect, verifyRole('landlord'), upload.array('images', 10), createPropertyValidator, handleValidation, createProperty);
router.get('/:id', protect, getProperty);

router.patch('/:id', protect, verifyRole('admin', 'landlord'), updatePropertyValidator, handleValidation, updateProperty);
router.delete('/:id', protect, verifyRole('admin', 'landlord'), deleteProperty);

module.exports = router;
