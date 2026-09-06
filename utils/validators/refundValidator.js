const { body, param, validationResult } = require('express-validator');

const refundValidator = [
  param('id').isUUID().withMessage('Invalid payment id'),
  body('reason').isString().trim().notEmpty().withMessage('reason is required'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  refundValidator,
  handleValidation,
};
