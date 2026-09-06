const { body, validationResult } = require('express-validator');

const broadcastValidator = [
  body('title').isString().trim().notEmpty().withMessage('title is required'),
  body('body').optional({ nullable: true }).isString().withMessage('body must be a string'),
  body('type').optional({ nullable: true }).isString().trim().withMessage('type must be a string'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  broadcastValidator,
  handleValidation,
};
