// /utils/validators/propertyValidator.js
const { body, query, param, validationResult } = require('express-validator');
const { propertyTypes, propertyStates } = require('../../config/constants');

const parseMaybeJsonObject = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const allowedTransitions = {
  drafted: ['sent'],
  sent: ['approved', 'declined'],
  approved: ['sent'],
  declined: ['sent'],
};

const isValidPropertyState = (state) => propertyStates.includes(state);

const canTransitionPropertyState = (fromState, toState) => {
  if (!isValidPropertyState(fromState) || !isValidPropertyState(toState)) {
    return false;
  }
  return (allowedTransitions[fromState] || []).includes(toState);
};

const denyStatePayload = body('state')
  .not()
  .exists()
  .withMessage('state is managed by workflow and cannot be set directly');

const propertyIdParamValidator = param('id').isUUID().withMessage('invalid property id');

/** 
 * body example
 * body{
 *  title:"proprty1",
 *  description:"description",
 *  pricePerMonth:100,
 *  totalRooms:1,
 *  availableRooms:1,
 *  type:"apartment",
 *  locationLat:1,
 *  locationLong:1,
 *  address:"address",
 *  amenities:{
 *    wifi:true,
 *    parking:true,
 *    gym:true,
 *    pool:true,
 *  }
 * }
 */ 
const createPropertyValidator = [
  denyStatePayload,
  body('title').isString().trim().notEmpty(),
  body('description').isString().trim().notEmpty(),
  body('pricePerMonth').isFloat({ gt: 0 }),
  body('totalRooms').isInt({ min: 1 }),
  body('availableRooms').isInt({ min: 0 }),
  body('type').isIn(propertyTypes),
  body('locationLat').isFloat({ min: -90, max: 90 }),
  body('locationLong').isFloat({ min: -180, max: 180 }),
  body('address').optional({ nullable: true }).isString(),
  body('amenities')
    .optional()
    .customSanitizer(parseMaybeJsonObject)
    .custom((value) => isPlainObject(value))
    .withMessage('amenities must be an object or valid JSON object string'),
];

const updatePropertyValidator = [
  denyStatePayload,
  body('title').optional().isString().trim().notEmpty(),
  body('description').optional().isString().trim().notEmpty(),
  body('pricePerMonth').optional().isFloat({ gt: 0 }),
  body('totalRooms').optional().isInt({ min: 1 }),
  body('availableRooms').optional().isInt({ min: 0 }),
  body('type').optional().isIn(propertyTypes),
  body('locationLat').optional().isFloat({ min: -90, max: 90 }),
  body('locationLong').optional().isFloat({ min: -180, max: 180 }),
  body('address').optional({ nullable: true }).isString(),
  body('amenities')
    .optional()
    .customSanitizer(parseMaybeJsonObject)
    .custom((value) => isPlainObject(value))
    .withMessage('amenities must be an object or valid JSON object string'),
  body('isActive').optional().isBoolean(),
];

const submitPropertyValidator = [
  propertyIdParamValidator,
];

const approvePropertyValidator = [
  propertyIdParamValidator,
];

const declinePropertyValidator = [
  propertyIdParamValidator,
  body('reason').optional().isString().trim().isLength({ max: 500 }),
];

const reopenPropertyValidator = [
  propertyIdParamValidator,
];

const propertyIdOnlyValidator = [
  propertyIdParamValidator,
];

const nearbyValidator = [
  query('lat').exists().withMessage('lat is required').bail().isFloat({ min: -90, max: 90 }),
  query('long').exists().withMessage('long is required').bail().isFloat({ min: -180, max: 180 }),
  query('radiusKm').optional().isFloat({ gt: 0, lt: 100 }), // reasonable max radius
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  createPropertyValidator,
  updatePropertyValidator,
  nearbyValidator,
  submitPropertyValidator,
  approvePropertyValidator,
  declinePropertyValidator,
  reopenPropertyValidator,
  propertyIdOnlyValidator,
  isValidPropertyState,
  canTransitionPropertyState,
  handleValidation,
};
