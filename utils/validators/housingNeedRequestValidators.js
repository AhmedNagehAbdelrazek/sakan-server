const { body, param, query, validationResult } = require('express-validator');
const {
  housingNeedRequestStatus,
  housingNeedRequestTypes,
} = require('../../config/constants');

const createHousingNeedRequestValidator = [
  body('area').trim().notEmpty().withMessage('area is required'),
  body('housingType')
    .isIn(housingNeedRequestTypes)
    .withMessage('housingType must be flat, room, or either'),
  body('message').trim().notEmpty().withMessage('message is required'),
];

const listHousingNeedRequestsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(housingNeedRequestStatus),
  query('area').optional().isString(),
  query('includeDemandSummary').optional().isBoolean().toBoolean(),
];

const updateHousingNeedRequestStatusValidator = [
  param('id').isUUID(),
  body('status').isIn(['reviewed', 'closed']),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  createHousingNeedRequestValidator,
  listHousingNeedRequestsValidator,
  updateHousingNeedRequestStatusValidator,
  handleValidation,
};
