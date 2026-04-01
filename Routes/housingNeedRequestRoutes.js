const router = require('express').Router();
const protect = require('../middlewares/protect');
const verifyRole = require('../utils/verifyRole');
const {
  create,
  list,
  updateStatus,
} = require('../Controllers/housingNeedRequestController');
const {
  createHousingNeedRequestValidator,
  listHousingNeedRequestsValidator,
  updateHousingNeedRequestStatusValidator,
  handleValidation,
} = require('../utils/validators/housingNeedRequestValidators');

router.post(
  '/',
  protect,
  verifyRole('student'),
  createHousingNeedRequestValidator,
  handleValidation,
  create
);

router.get(
  '/',
  protect,
  verifyRole('admin'),
  listHousingNeedRequestsValidator,
  handleValidation,
  list
);

router.patch(
  '/:id/status',
  protect,
  verifyRole('admin'),
  updateHousingNeedRequestStatusValidator,
  handleValidation,
  updateStatus
);

module.exports = router;
