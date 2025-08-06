const asyncHandler = require('express-async-handler');
const userService = require('../Services/userService.js');

exports.getAllUsers = asyncHandler(async (req, res) => {
    const users = await userService.getAllUsers();

    res.status(200).json(users);
});

exports.getMe = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.user.id);
    res.status(200).json(user);
});