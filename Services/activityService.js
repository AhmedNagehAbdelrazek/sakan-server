
const { UserActivity, User } = require("../Models/index");
const ApiError = require("../utils/ApiError");

class ActivityService {
    static async getActivities(limit, offset){
        const activities = await UserActivity.findAll(
            {
                limit,
                offset,
                include: {
                    model: User,
                    attributes: ['username', 'email','role'],
                }
            }
        );
    
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
