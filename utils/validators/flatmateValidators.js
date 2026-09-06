// /utils/validators/flatmateValidators.js
const { body, param, query, validationResult } = require('express-validator');
const { propertyTypes } = require('../../config/constants');

const createFlatmateRequestValidator = [
  body('preferredBudget').isFloat({ gt: 0 }),
  body('preferredType').isIn(propertyTypes).withMessage('Invalid property type, it should be one of: ' + propertyTypes.join(', ')),
  body('phoneNumber').isString().trim().notEmpty().isLength({ max: 20 }).withMessage('phoneNumber is required and must be at most 20 characters'),
  body('message').optional({ nullable: true }).isString(),
  body('peopleWanted').isInt({ min: 1 }),
  body('radiusKm').optional({ nullable: true }).isInt({ min: 1, max: 100 }),
  body('locationLat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('locationLong').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
];

const deleteFlatmateRequestValidator = [
  param('id').isUUID().withMessage('Invalid flatmate request ID'),
];

const matchesValidator = [
  query('requestId').optional().isUUID().withMessage('Invalid request ID'),
  query('budgetTolerance').optional().isFloat({ min: 0, max: 1 }),
  query('page').optional().isInt({ min: 1 }).withMessage('Invalid page, it should be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit, it should be an integer between 1 and 100'),
  query('radiusStrategy').optional().isIn(['min', 'max']).withMessage('Invalid radius strategy, it should be either "min" or "max"'),
  query('gender').optional().isString().withMessage('Invalid gender, it should be a string'),
  query('university').optional().isString().withMessage('Invalid university, it should be a string'),
];

const joinInterestCreateValidator = [
  param('id').isUUID().withMessage('Invalid flatmate request ID'),
  body('message').optional({ nullable: true }).isString().withMessage('Invalid message, it should be a string'),
];

const joinInterestIdValidator = [
  param('id').isUUID().withMessage('Invalid flatmate request ID'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  createFlatmateRequestValidator,
  deleteFlatmateRequestValidator,
  matchesValidator,
  joinInterestCreateValidator,
  joinInterestIdValidator,
  handleValidation,
};
