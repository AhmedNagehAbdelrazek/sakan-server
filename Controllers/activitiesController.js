const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const ActivityService = require('../Services/activityService');

exports.getActivities = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const activities = await ActivityService.getActivities(limit, offset);

    res.json(activities);
});

exports.getActivity = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const activity = await ActivityService.getActivity(id);

    res.json(activity);
});

exports.getUserActivities = asyncHandler(async (req, res) => {
    const { user } = req;

    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const activities = await ActivityService.getUserActivities(user, limit, offset);

    res.json(activities);
});

exports.getUserActivity = asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    const activity = await ActivityService.getUserActivity(user, id);

    if (activity.userId != user.id) {
        throw new ApiError('This activity belongs to another user so you cannot access it.', 403);
    }

    res.json(activity);
})

exports.logUserActivity = asyncHandler(async (req, res) => {
    const { user } = req;
    const { activityType, activityDetails } = req.body;

    const activity = await ActivityService.logUserActivity(user, activityType, activityDetails);

    res.status(201).json(activity);
});
