// /utils/validators/flatmateValidators.js
const { body, param, query, validationResult } = require('express-validator');
const { propertyTypes } = require('../../config/constants');

const createFlatmateRequestValidator = [
  body('preferredBudget').isFloat({ gt: 0 }),
  body('preferredType').isIn(propertyTypes),
  body('message').optional({ nullable: true }).isString(),
  body('peopleWanted').isInt({ min: 1 }),
  body('radiusKm').isInt({ min: 1, max: 100 }),
  body('locationLat').isFloat({ min: -90, max: 90 }),
  body('locationLong').isFloat({ min: -180, max: 180 }),
];

const deleteFlatmateRequestValidator = [
  param('id').isUUID(),
];

const matchesValidator = [
  query('requestId').optional().isUUID(),
  query('budgetTolerance').optional().isFloat({ min: 0, max: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('radiusStrategy').optional().isIn(['min', 'max']),
  query('gender').optional().isString(),
  query('university').optional().isString(),
];

const joinInterestCreateValidator = [
  param('id').isUUID(),
  body('message').optional({ nullable: true }).isString(),
];

const joinInterestIdValidator = [
  param('id').isUUID(),
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
