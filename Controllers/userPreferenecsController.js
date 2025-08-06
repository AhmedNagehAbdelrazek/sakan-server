const userPreferenceService = require('../Services/userPrefrenceService.js');
exports.getpreferneces = async (req, res) => {
    const {user} = req;
    const preferences = await userPreferenceService.getPreferences(user.id);
    return res.status(200).json(preferences);
}

exports.updatePreferences = async (req, res) => {
    const {user} = req;
    const preferences = await userPreferenceService.updatePreferences(user.id, req.body);
    return res.status(200).json(preferences);
}