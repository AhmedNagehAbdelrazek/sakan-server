// /utils/validators/propertyValidator.js
const { body, query, validationResult } = require('express-validator');
const { propertyTypes } = require('../../config/constants');

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
  body('title').isString().trim().notEmpty(),
  body('description').isString().trim().notEmpty(),
  body('pricePerMonth').isFloat({ gt: 0 }),
  body('totalRooms').isInt({ min: 1 }),
  body('availableRooms').isInt({ min: 0 }),
  body('type').isIn(propertyTypes),
  body('locationLat').isFloat({ min: -90, max: 90 }),
  body('locationLong').isFloat({ min: -180, max: 180 }),
  body('address').optional({ nullable: true }).isString(),
  body('amenities').optional().isObject(),
];

const updatePropertyValidator = [
  body('title').optional().isString().trim().notEmpty(),
  body('description').optional().isString().trim().notEmpty(),
  body('pricePerMonth').optional().isFloat({ gt: 0 }),
  body('totalRooms').optional().isInt({ min: 1 }),
  body('availableRooms').optional().isInt({ min: 0 }),
  body('type').optional().isIn(propertyTypes),
  body('locationLat').optional().isFloat({ min: -90, max: 90 }),
  body('locationLong').optional().isFloat({ min: -180, max: 180 }),
  body('address').optional({ nullable: true }).isString(),
  body('amenities').optional().isObject(),
  body('isActive').optional().isBoolean(),
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
  handleValidation,
};
