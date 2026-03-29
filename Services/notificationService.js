const { Notification, UserPreference } = require("../Models/index");

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
                createdAt: newNotification.createdAt,
            });
        }

        return newNotification;
    } catch (error) {
        console.error('Error sending notification:', error);
        throw error;
    }
}

module.exports = notification;
