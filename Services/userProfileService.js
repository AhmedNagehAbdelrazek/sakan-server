const UserProfile = require("../Models/user_profile");
const PickExistVars = require("../utils/PickExistVars");
const ApiError = require("../utils/ApiError");

class UserProfileService {
    static async getUserProfile(userId) {
        let userProfile = await UserProfile.findOne({
            where: { userId },
            attributes: ["firstName", "lastName", "bio", "profilePicture","university","gender","studyField","living_status","budget","location","locationCoordinates"],
        });
        if (!userProfile) {
            // if there was no user profile create new one
            await UserProfile.create({
                userId: userId,
            });

            userProfile = UserProfile.findOne({
                where: { userId: userId },
                attributes: ["firstName", "lastName", "bio", "profilePicture","university","gender","studyField","living_status","budget","location","locationCoordinates"],
            });

            return {
                firstName: userProfile.firstName,
                lastName: userProfile.lastName,
                bio: userProfile.bio,
                profilePicture: userProfile.profilePicture,
                university: userProfile.university,
                gender: userProfile.gender,
                studyField: userProfile.studyField,
                living_status: userProfile.living_status,
                budget: userProfile.budget,
                location: userProfile.location,
                locationCoordinates: userProfile.locationCoordinates,
            };
        }
        return userProfile;
    }

    static async updateUserProfile(userId, data) {
        const userProfile = await UserProfile.findOne({
            where: { userId },
            attributes: ["firstName", "lastName", "bio", "profilePicture","university","gender","studyField","living_status","budget","location","locationCoordinates"],
        });
        if (!userProfile) {
            throw new ApiError("User not found", 404);
        }
        const updatedValues = PickExistVars(data, [
            "firstName",
            "lastName",
            "bio",
            "profilePicture",
            "university",
            "gender",
            "studyField",
            "living_status",
            "budget",
            "location",
            "locationCoordinates",
        ]);
        await userProfile.update(updatedValues);
        return userProfile;
    }
}

module.exports = UserProfileService;
