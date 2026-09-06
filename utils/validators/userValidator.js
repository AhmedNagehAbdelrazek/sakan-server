const { body, query, param, validationResult } = require('express-validator');
const { roles } = require('../../config/constants');

const listUsersValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100'),
  query('search').optional().isString().trim().withMessage('search must be a string'),
  query('role').optional().isIn(roles).withMessage('Invalid role, it should be one of: ' + roles.join(', ')),
  query('verified').optional().isIn(['true', 'false']).withMessage('verified must be true or false'),
  query('active').optional().isIn(['true', 'false']).withMessage('active must be true or false'),
];

const updateUserValidator = [
  param('id').isUUID().withMessage('Invalid user id'),
  body('role').optional().isIn(roles).withMessage('Invalid role, it should be one of: ' + roles.join(', ')),
  body('verified').optional().isBoolean().withMessage('verified must be a boolean'),
  body('active').optional().isBoolean().withMessage('active must be a boolean'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  listUsersValidator,
  updateUserValidator,
  handleValidation,
};
