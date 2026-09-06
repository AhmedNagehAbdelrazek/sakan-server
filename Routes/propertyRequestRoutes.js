const router = require('express').Router();
const protect = require('../middlewares/protect');
const verifyRole = require('../utils/verifyRole');
const { create, list, listMine, getById, remove, updateStatus } = require('../Controllers/propertyRequestController');
const {
  createPropertyRequestValidator,
  updateStatusValidator,
  listPropertyRequestValidator,
  propertyRequestIdValidator,
  handleValidation,
} = require('../utils/validators/propertyRequestValidator');

router.post('/', protect, verifyRole('student', 'landlord', 'admin', 'super_admin'), createPropertyRequestValidator, handleValidation, create);
router.get('/mine', protect, verifyRole('student', 'landlord'), listMine);
router.get('/', protect, verifyRole('admin','super_admin','manager'), listPropertyRequestValidator, handleValidation, list);
router.get('/:id', protect, verifyRole('admin','super_admin','manager'), propertyRequestIdValidator, handleValidation, getById);
router.delete('/:id', protect, verifyRole('student', 'landlord', 'admin', 'super_admin'), propertyRequestIdValidator, handleValidation, remove);
router.patch('/:id/status', protect, verifyRole('admin','super_admin'), updateStatusValidator, handleValidation, updateStatus);

module.exports = router;
