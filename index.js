const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

// 1. Setup: Allow large images and point to 'public' folder
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use(express.json({limit: '100mb'}));

// 2. Database: Load users from file
let users = [];
const dbPath = path.join(__dirname, 'users.json');
if (fs.existsSync(dbPath)) {
    try { users = JSON.parse(fs.readFileSync(dbPath)); } 
    catch(e) { console.log("DB Reset"); }
}

// 3. Routes: Serve the HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(publicPath, 'chat.html'));
});

app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(publicPath, 'sw.js'));
});

// 4. Auth Logic
app.post('/signup', (req, res) => {
  if(users.find(u => u.user === req.body.user)) return res.sendStatus(409);
  users.push(req.body);
  fs.writeFileSync(dbPath, JSON.stringify(users));
  res.sendStatus(200);
});

app.post('/login', (req, res) => {
  const match = users.find(u => u.user === req.body.user && u.pass === req.body.pass);
  if(match) res.json(match); else res.sendStatus(401);
});

// 5. Real-Time Logic (Calls & Chat)
let onlineUsers = {};

io.on('connection', (socket) => {
  // User Logs In
  socket.on('login', (data) => {
    socket.username = data.user;
    onlineUsers[data.user] = { id: socket.id, ...data };
    io.emit('update-online', Object.values(onlineUsers));
  });

  // Call Requests
  socket.on('call-request', (data) => {
    const target = onlineUsers[data.to];
    if (target) io.to(target.id).emit('incoming-call', data);
  });

  socket.on('call-rejected', (data) => {
    const target = onlineUsers[data.to];
    if (target) io.to(target.id).emit('stop-ringing');
  });

  // Chat Messages
  socket.on('send-msg', (data) => io.emit('receive-msg', data));
  
  // User Disconnects
  socket.on('disconnect', () => {
    if(socket.username) {
        delete onlineUsers[socket.username];
        io.emit('update-online', Object.values(onlineUsers));
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server Active on Port ' + PORT));
