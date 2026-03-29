const asyncHandler = require('express-async-handler');
const notificationHistoryService = require('../Services/notificationHistoryService');

exports.listMyNotifications = asyncHandler(async (req, res) => {
  const { page, limit, unread } = req.query;
  const result = await notificationHistoryService.listForUser(req.user.id, { page, limit, unread });
  res.status(200).json(result);
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await notificationHistoryService.markRead(req.user.id, id);
  res.status(200).json({ data: notification });
});

exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await notificationHistoryService.markAllRead(req.user.id);
  res.status(200).json(result);
});
