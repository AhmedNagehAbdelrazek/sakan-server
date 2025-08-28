const router = require('express').Router();
const protect = require('../middlewares/protect');
const {createProperty,listProperties,getProperty,updateProperty,deleteProperty,nearbyCount} = require('../Controllers/propertyController');
const {createPropertyValidator,updatePropertyValidator,nearbyValidator,handleValidation} = require('../utils/validators/propertyValidator');
const verifyRole = require('../utils/verifyRole');

router.get('/nearby', protect, nearbyValidator, handleValidation, nearbyCount);
router.get('/', protect, verifyRole('admin', 'landlord'), listProperties);

router.post('/', protect, verifyRole('landlord'), createPropertyValidator, handleValidation, createProperty);
router.get('/:id', protect, getProperty);

router.patch('/:id', protect, verifyRole('admin', 'landlord'), updatePropertyValidator, handleValidation, updateProperty);
router.delete('/:id', protect, verifyRole('admin', 'landlord'), deleteProperty);

module.exports = router;
