const { Op } = require("sequelize");
const { Notification, UserPreference, User } = require("../Models/index");

async function notification(io, { event, userId, message, type, roomId }) {
    try {
        const resolvedRoomId = roomId || `notifications_${userId}`;
        const eventToEmit = event || 'notification';

        // Fetch user preferences (default: enabled if no record exists yet)
        const userPreference = await UserPreference.findOne({ where: { userId } });
        const notificationsEnabled = userPreference ? !!userPreference.notification : true;

        // Always persist durable notification history (contract requirement)
        const newNotification = await Notification.create({
            userId,
            notificationType: type,
            notificationContent: {
                title: message?.title,
                body: message?.body,
            },
        });

        if (notificationsEnabled && io) {
            io.to(resolvedRoomId).emit(eventToEmit, {
                id: newNotification.id,
                userId,
                type: newNotification.notificationType,
                content: newNotification.notificationContent,
                read: newNotification.read,
                createdat: newNotification.createdat,
            });
        }

        return newNotification;
    } catch (error) {
        console.error('Error sending notification:', error);
        throw error;
    }
}

// Send an announcement to every active, opted-in user.
// Durable history rows are batched; real-time emit is optional (io may be null).
async function broadcast(io, { title, body, type = 'broadcast' } = {}) {
    const activeUsers = await User.findAll({ where: { active: true }, attributes: ['id'] });
    const userIds = activeUsers.map(u => u.id);

    if (userIds.length === 0) return { delivered: 0 };

    // Missing preference row = opted in; only explicit false opts out.
    const prefs = await UserPreference.findAll({ where: { userId: { [Op.in]: userIds } } });
    const optedOut = new Set(prefs.filter(p => p.notification === false).map(p => p.userId));
    const recipients = userIds.filter(id => !optedOut.has(id));

    if (recipients.length === 0) return { delivered: 0 };

    const rows = recipients.map(userId => ({
        userId,
        notificationType: type,
        notificationContent: { title, body },
        read: false,
    }));

    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await Notification.bulkCreate(rows.slice(i, i + BATCH_SIZE));
    }

    if (io) {
        for (const userId of recipients) {
            io.to(`notifications_${userId}`).emit('notification', {
                userId,
                type,
                content: { title, body },
                read: false,
            });
        }
    }

    return { delivered: recipients.length };
}

notification.broadcast = broadcast;

module.exports = notification;
