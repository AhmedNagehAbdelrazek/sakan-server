const { body, param, query, validationResult } = require('express-validator');
const { propertyTypes, requestTypes, requestStatus, requestStatusTransitions } = require('../../config/constants');
const { PropertyRequest } = require('../../Models');

const createPropertyRequestValidator = [
  body('message').isString().trim().notEmpty().withMessage('message is required'),
  body('propertyType').isIn(propertyTypes).withMessage('Invalid property type, it should be one of: ' + propertyTypes.join(', ')),
  body('requestType').isIn(requestTypes).withMessage('Invalid request type, it should be one of: ' + requestTypes.join(', ')),
  body('locationLat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('locationLong').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('address').optional({ nullable: true }).isString().withMessage('Invalid address, it should be a string'),
  body('major').optional({ nullable: true }).isString().withMessage('Invalid major, it should be a string'),
  body('phone').optional({ nullable: true }).isString().trim().notEmpty().withMessage('Invalid phone number, it should be a string'),
];

const updateStatusValidator = [
  param('id').isUUID().withMessage('Invalid property request id'),
  body('status')
    .isIn(requestStatus).withMessage('Invalid status')
    .custom(async (status, { req }) => {
      const record = await PropertyRequest.findByPk(req.params.id);
      if (!record) return true;
      const allowedNext = Object.values(requestStatusTransitions)
        .filter((t) => t.from === record.status)
        .map((t) => t.to);
      if (!allowedNext.includes(status)) {
        throw new Error(`Invalid transition from ${record.status} to ${status}`);
      }
      return true;
    }),
];

const listPropertyRequestValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(requestStatus),
];

const propertyRequestIdValidator = [
  param('id').isUUID().withMessage('Invalid property request id'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ errors: errors.array() });
};

module.exports = {
  createPropertyRequestValidator,
  updateStatusValidator,
  listPropertyRequestValidator,
  propertyRequestIdValidator,
  handleValidation,
};
