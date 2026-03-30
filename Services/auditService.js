const { UserActivity } = require('../Models');
const ApiError = require('../utils/ApiError');

class AuditService {
  static async logActivity({ userId, activityType, activityDetails = {}, transaction } = {}) {
    if (!userId) {
      throw new ApiError('userId is required for audit logging', 400);
    }

    if (!activityType) {
      throw new ApiError('activityType is required for audit logging', 400);
    }

    const options = transaction ? { transaction } : undefined;

    return UserActivity.create(
      {
        userId,
        activityType,
        activityDetails,
      },
      options
    );
  }
}

module.exports = AuditService;
