const { Op } = require('sequelize');
const { UserActivity, User } = require('../Models/index');
const ApiError = require('../utils/ApiError');
const { resolveDateRange } = require('../utils/dateRange');

class ActivityService {
    static async getActivities({ page = 1, limit = 20, from, to, activityType, actorId, entityType, entityId } = {}) {
        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

        const where = {};

        if (from || to) {
            const range = resolveDateRange({ from, to, applyDefault: false });
            where.timestamp = {};
            if (range.from) where.timestamp[Op.gte] = range.from;
            if (range.to) where.timestamp[Op.lte] = range.to;
        }

        if (activityType) where.activityType = activityType;
        if (actorId) where.userId = actorId;

        const detailsFilter = {};
        if (entityType) detailsFilter.entityType = entityType;
        if (entityId) detailsFilter.entityId = entityId;

        if (Object.keys(detailsFilter).length > 0) {
            where.activityDetails = { [Op.contains]: detailsFilter };
        }

        const activities = await UserActivity.findAll({
            where,
            limit: safeLimit,
            offset: (safePage - 1) * safeLimit,
            order: [['timestamp', 'DESC']],
            include: {
                model: User,
                attributes: ['username', 'email', 'role'],
            },
        });

        return activities;
    }

    static async getActivity(id){
        const activity = await UserActivity.findByPk(id,{
            include: {
                model: User,
                attributes: ['username', 'email','role'],
            }
        });
    
        if (!activity) {
            throw new ApiError('There is no activity with this id.', 404);
        }
    
        return activity;
    }

    static async getUserActivities(user, limit, offset){
        const activities = await UserActivity.findAll({
            where: { userId: user.id },
            limit,
            offset,
        });
    
        return activities;
    }

    static async getUserActivity(user, id){
        const activity = await UserActivity.findByPk(id,{
            include: {
                model: User,
                attributes: ['username', 'email','role'],
            }
        });
    
        if (!activity) {
            throw new ApiError('There is no activity with this id.', 404);
        }
    
        if (activity.userId != user.id) {
            throw new ApiError('This activity belongs to another user so you cannot access it.', 403);
        }
    
        return activity;
    }

    static async logUserActivity(user, activityType, activityDetails){
        const activity = await UserActivity.create({
            userId: user.id,
            activityType,
            activityDetails,
        },{returning: true});
    
        activity.save();
    
        return activity;
    }
}

module.exports = ActivityService;
