const {UserPreference} = require('../Models/index.js');
const ApiError = require('../utils/ApiError.js');
class UserPreferenceService {
    static async getPreferences(userId) {
        const preferences = await UserPreference.findOne({where:{userId}},{
            attributes: ["theme", "notification", "language"],
        });
        if (!preferences) {
            throw new ApiError("User not found", 404);
        }
        return preferences;
    }
    static async updatePreferences(userId, newPreferences) {
        const preferences = await UserPreference.findOne({
            where:{
                userId: userId,
            }
        });
        if (!preferences) {
            throw new ApiError("User not found", 404);
        }
        const {theme, notification, language} = newPreferences;
        
        try {
            await UserPreference.update({
                theme: theme || preferences.theme,
                notification: notification || preferences.notification,
                language: language || preferences.language,
            },
            {
                where: { userId: preferences.userId }
            }
        );
            await preferences.reload();
            return preferences;
        }catch (error) {
            throw new ApiError(error.message, 500);
        }
    }
}

module.exports = UserPreferenceService;
