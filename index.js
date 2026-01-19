const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

// Crucial: Increase limit to allow high-quality profile pics
app.use(express.json({limit: '100mb'}));
app.use(express.static('public'));

let users = [];
const dbPath = './users.json';
if (fs.existsSync(dbPath)) users = JSON.parse(fs.readFileSync(dbPath));

// Login/Sign-up Routes
app.post('/signup', (req, res) => {
  users.push(req.body);
  fs.writeFileSync(dbPath, JSON.stringify(users));
  res.sendStatus(200);
});

app.post('/login', (req, res) => {
  const match = users.find(u => u.user === req.body.user && u.pass === req.body.pass);
  if(match) res.json(match); else res.sendStatus(401);
});

// Serve the Chat UI after login
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

let onlineUsers = {};
io.on('connection', (socket) => {
  socket.on('login', (data) => {
    onlineUsers[socket.id] = data;
    io.emit('update-online', Object.values(onlineUsers));
  });
  socket.on('send-msg', (data) => io.emit('receive-msg', data));
  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    io.emit('update-online', Object.values(onlineUsers));
  });
});

http.listen(process.env.PORT || 3000);
