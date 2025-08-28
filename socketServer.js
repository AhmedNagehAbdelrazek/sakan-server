const { Server } = require("socket.io");
const { User } = require("./Models/index");

module.exports = function(server) {
  const io = new Server(server, {
    cors: {
      origin: "*", // Update this with your client's URL
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);
    const user = socket.user;
    try {
      //switch user status to online
      await User.update({socketId: socket.id, online: true}, {where: { id: user.id }});
      user.socketId = socket.id;

    } catch (err) {
      console.log(err.message)
      socket.emit("update user status", {"message": err.message});
    }
    console.log(user);
    
    // Initialize notification socket events
    require('./sockets/notificationSocket')(io, socket);

    // Initialize chat socket events
    require('./sockets/chatSocket')(io, socket);

    socket.on('disconnect', async () => {
      try {
        await User.update({ socketId: null, online: false }, { where: { id: user.id } })
        socket.emit("update user status", {"status": "offline", user});
      } catch (err) {
        socket.emit("update user status", {"messsage": err.message});
      }
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};
