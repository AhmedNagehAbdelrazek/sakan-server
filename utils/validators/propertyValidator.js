// /utils/validators/propertyValidator.js
const { body, query, param, validationResult } = require('express-validator');
const { propertyTypes, propertyStates } = require('../../config/constants');

const parseMaybeJsonObject = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
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
 *  locationLat:1,     // optional
 *  locationLong:1,    // optional
 *  address:"address", // optional
 *  amenities:{
 *    wifi:true,
 *    parking:true,
 *    gym:true,
 *    pool:true,
 *  }
 * }
 * 
 * locationLat, locationLong and address are all optional.
 * If only one coordinate is provided an error is raised.
 */ 
const createPropertyValidator = [
  denyStatePayload,
  body('title').isString().trim().notEmpty(),
  body('description').isString().trim().notEmpty(),
  body('pricePerMonth').isFloat({ gt: 0 }),
  body('totalRooms').isInt({ min: 1 }),
  body('availableRooms').isInt({ min: 0 }),
  body('type').isIn(propertyTypes).withMessage('Invalid property type, it should be one of: ' + propertyTypes.join(', ')),
  body('city').isString().trim().notEmpty().withMessage('city is required'),
  body('locationLat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('locationLong').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('address').optional({ nullable: true }).isString().withMessage('Invalid address, it should be a string'),
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
  body('city').optional().isString().trim().notEmpty().withMessage('city must be a non-empty string'),
  body('locationLat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('locationLong').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('address').optional({ nullable: true }).isString().withMessage('Invalid address, it should be a string'),
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
  body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Invalid reason, it should be a string with a maximum length of 500 characters'),
];

const reopenPropertyValidator = [
  propertyIdParamValidator,
];

const propertyIdOnlyValidator = [
  propertyIdParamValidator,
];

const searchPropertyValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('q').optional().isString().trim(),
  query('city').optional().isString().trim().notEmpty(),
  query('type').optional().isIn(propertyTypes).withMessage('Invalid property type, it should be one of: ' + propertyTypes.join(', ')),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a positive number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a positive number'),
  query('minRooms').optional().isInt({ min: 1 }).withMessage('minRooms must be a positive integer'),
  query('maxRooms').optional().isInt({ min: 1 }).withMessage('maxRooms must be a positive integer'),
  query('state').optional().isIn(propertyStates).withMessage('Invalid state, it should be one of: ' + propertyStates.join(', ')),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('latitude must be between -90 and 90'),
  query('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('longitude must be between -180 and 180'),
  query('radiusKm').optional().isFloat({ gt: 0, lt: 100 }).withMessage('radiusKm must be between 0 and 100'),
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
  searchPropertyValidator,
  submitPropertyValidator,
  approvePropertyValidator,
  declinePropertyValidator,
  reopenPropertyValidator,
  propertyIdOnlyValidator,
  isValidPropertyState,
  canTransitionPropertyState,
  handleValidation,
};
