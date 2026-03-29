const router = require('express').Router();
const protect = require('../middlewares/protect');
const {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../Controllers/notificationController');

router.get('/', protect, listMyNotifications);
router.patch('/:id/read', protect, markNotificationRead);
router.patch('/read-all', protect, markAllNotificationsRead);

module.exports = router;
