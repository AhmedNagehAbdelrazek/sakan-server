const { query, validationResult } = require('express-validator');

const dashboardQueryValidator = [
  query('from').optional({ nullable: true }).isISO8601().withMessage('from must be a valid date'),
  query('to').optional({ nullable: true }).isISO8601().withMessage('to must be a valid date'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  dashboardQueryValidator,
  handleValidation,
};
