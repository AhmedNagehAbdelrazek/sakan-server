const { Notification } = require('../Models');
const ApiError = require('../utils/ApiError');

async function listForUser(userId, { page = 1, limit = 20, unread } = {}) {
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const where = { userId };
  if (typeof unread !== 'undefined') {
    where.read = unread === true || unread === 'true' ? false : true;
  }

  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });

  return {
    page: safePage,
    limit: safeLimit,
    total: count,
    data: rows,
  };
}

async function markRead(userId, notificationId) {
  const notification = await Notification.findOne({ where: { id: notificationId, userId } });
  if (!notification) throw new ApiError('Notification not found', 404);

  notification.read = true;
  await notification.save();
  return notification;
}

async function markAllRead(userId) {
  await Notification.update({ read: true }, { where: { userId, read: false } });
  return { ok: true };
}

module.exports = {
  listForUser,
  markRead,
  markAllRead,
};
