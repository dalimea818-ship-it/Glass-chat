const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use(express.json({limit: '50mb'}));

let onlineUsers = {}; // Stores { username: { socketId, pfp, phone } }

io.on('connection', (socket) => {
  socket.on('login', (data) => {
    socket.username = data.user;
    onlineUsers[data.user] = { socketId: socket.id, ...data };
    // We don't broadcast all users anymore for privacy
  });

  // 1. Sending a Contact Request
  socket.on('request-contact', (data) => {
    const target = Object.values(onlineUsers).find(u => u.phone === data.targetPhone);
    if (target) {
      io.to(target.socketId).emit('contact-invite', { from: data.fromUser, pfp: data.fromPfp });
    }
  });

  // 2. Accepting a Contact Request
  socket.on('accept-contact', (data) => {
    const target = onlineUsers[data.to];
    const me = onlineUsers[data.from];
    if (target && me) {
      io.to(target.socketId).emit('contact-added', me);
      io.to(me.socketId).emit('contact-added', target);
    }
  });

  // 3. Private Messaging
  socket.on('send-private-msg', (data) => {
    const target = onlineUsers[data.to];
    if (target) {
      io.to(target.socketId).emit('receive-msg', data);
    }
    // Echo back to sender for their own UI
    socket.emit('receive-msg', data);
  });

  socket.on('disconnect', () => {
    delete onlineUsers[socket.username];
  });
});

http.listen(process.env.PORT || 3000);
