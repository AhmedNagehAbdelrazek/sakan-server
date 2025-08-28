// /utils/validators/applicationValidator.js
const { body, query, param, validationResult } = require('express-validator');

const createApplicationValidator = [
  body('propertyId').isUUID().withMessage('propertyId must be a valid UUID'),
  body('isForSharing').optional().isBoolean(),
  body('message').optional({ nullable: true }).isString(),
  body('totalAmount').optional().isFloat({ gt: 0 }),
];

const approveValidator = [
  param('id').isUUID(),
];

const rejectValidator = [
  param('id').isUUID(),
  body('reason').optional({ nullable: true }).isString(),
];

const payValidator = [
  param('id').isUUID(),
  body('method').isIn(['card', 'wallet', 'cash', 'transfer']).withMessage('Invalid payment method'),
];

const checkInValidator = [
  param('id').isUUID(),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  createApplicationValidator,
  approveValidator,
  rejectValidator,
  payValidator,
  checkInValidator,
  handleValidation,
};
