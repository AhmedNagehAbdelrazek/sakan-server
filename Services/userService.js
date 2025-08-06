const {User} = require('../Models/index.js');
const ApiError = require('../utils/ApiError.js');
class UserService {
    static async getAllUsers() {
        const users = await User.findAll({
            attributes: ["id", "username", "email", "role"],
        });
        return users;
    }
    static async getUserById(id) {
        const user = await User.findByPk(id, {
            attributes: ["id", "username", "email", "role"],
        });
        if (!user) {
            throw new ApiError("User not found", 404);
        }

        return user;
    }
}

module.exports = UserService;
