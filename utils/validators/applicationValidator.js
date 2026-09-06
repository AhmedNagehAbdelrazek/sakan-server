// /utils/validators/applicationValidator.js
const { body, param, validationResult } = require('express-validator');
const { paymentMethods, currency, rejectionReasons } = require('../../config/constants');

const createApplicationValidator = [
  body('propertyId').isUUID().withMessage('propertyId must be a valid UUID'),
  body('isForSharing').optional().isBoolean().withMessage('Invalid isForSharing, it should be a boolean'),
  body('message').optional({ nullable: true }).isString().withMessage('Invalid message, it should be a string'),
  body('totalAmount').optional().isFloat({ gt: 0 }).withMessage('Invalid total amount, it should be a positive number'),
];

const approveValidator = [
  param('id').isUUID().withMessage('Invalid application ID'),
];

const rejectValidator = [
  param('id').isUUID().withMessage('Invalid application ID'),
  body('reasonCategory')
    .isIn(rejectionReasons)
    .withMessage('Invalid reasonCategory, it should be one of: ' + rejectionReasons.join(', ')),
  body('detail').optional({ nullable: true }).isString().withMessage('Invalid detail, it should be a string'),
];

const payValidator = [
  param('id').isUUID().withMessage('Invalid application ID'),
  body('method')
    .optional({ nullable: true })
    .isIn(paymentMethods).withMessage('Invalid payment method, it should be one of: ' + paymentMethods.join(', ')),
  body('transactionId').optional({ nullable: true }).isString().withMessage('Invalid transaction ID, it should be a string'),
  body('paymentDate').optional({ nullable: true }).isISO8601().toDate().withMessage('Invalid payment date, it should be a valid date'),
  body('currency')
    .optional({ nullable: true })
    .isIn(currency)
    .withMessage('Invalid currency, it should be one of: ' + currency.join(', ')),
];

const checkInValidator = [
  param('id').isUUID().withMessage('Invalid application ID'),
];

const completeValidator = [
  param('id').isUUID().withMessage('Invalid application ID'),
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
  completeValidator,
  handleValidation,
};
