const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// 1. External Storage Connection (MongoDB)
const MONGO_URI = process.env.MONGO_URI || "YOUR_MONGODB_CONNECTION_STRING_HERE";
mongoose.connect(MONGO_URI).then(() => console.log("External Message Storage Connected"));

const MessageSchema = new mongoose.Schema({
  room: String, // format: "user1-user2" (alphabetical)
  sender: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// 2. Person Storage (Local File)
const dbPath = path.join(__dirname, 'users.json');
let users = JSON.parse(fs.readFileSync(dbPath, 'utf-8') || "[]");

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({limit: '50mb'}));

io.on('connection', (socket) => {
  socket.on('login', (data) => {
    socket.username = data.user;
    // Update socket ID in local storage
    const idx = users.findIndex(u => u.user === data.user);
    if(idx !== -1) users[idx].socketId = socket.id;
  });

  // Load External History when opening a chat
  socket.on('load-history', async (data) => {
    const room = [data.from, data.to].sort().join('-');
    const history = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
    socket.emit('chat-history', history);
  });

  socket.on('send-private-msg', async (data) => {
    const room = [data.from, data.to].sort().join('-');
    
    // Save to External Storage
    const newMsg = new Message({ room, sender: data.from, text: data.text });
    await newMsg.save();

    // Send to Target if online
    const target = users.find(u => u.user === data.to);
    if (target && target.socketId) {
      io.to(target.socketId).emit('receive-msg', data);
    }
    socket.emit('receive-msg', data); // Echo to sender
  });

  // Handle Contact Requests (Saves to users.json)
  socket.on('accept-contact', (data) => {
    const me = users.find(u => u.user === data.from);
    const them = users.find(u => u.user === data.to);
    
    if(!me.contacts) me.contacts = [];
    if(!them.contacts) them.contacts = [];
    
    me.contacts.push(data.to);
    them.contacts.push(data.from);
    
    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
    io.to(me.socketId).emit('contact-added', them);
    io.to(them.socketId).emit('contact-added', me);
  });
});

http.listen(process.env.PORT || 3000);
