const notificationService = require('../Services/notificationService');
const { User } = require("../Models/index");

module.exports = (io, socket) => {
    socket.on('subscribeToNotifications', (userId) => {
      socket.join(`notifications_${userId}`);
    });
  
    socket.on('sendNotification', async (notificationData) => {
      // Persist the notification and emit it to the user
    });
  };
  