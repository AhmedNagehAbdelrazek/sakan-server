/**
 * @constructor
 * @param {Array} roles - Array of roles to be compared
 * @returns {Function} - Middleware function
 * @description - Middleware function to verify the role of the user
 * @requires - it require the protect middleware to function properly
 */

const ApiError = require("./ApiError");

const verifyRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError('Forbidden', 403));
  }
  next();
};

module.exports = verifyRole;
