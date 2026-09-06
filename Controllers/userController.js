const asyncHandler = require('express-async-handler');
const userService = require('../Services/userService.js');

exports.getAllUsers = asyncHandler(async (req, res) => {
    const users = await userService.getAllUsers(req.query);

    res.status(200).json(users);
});

exports.getUserById = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.id, { includeProfile: true });

    res.status(200).json(user);
});

exports.updateUser = asyncHandler(async (req, res) => {
    const user = await userService.updateUser(req.user, req.params.id, req.body);

    res.status(200).json(user);
});

exports.getMe = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.user.id);
    res.status(200).json(user);
});
