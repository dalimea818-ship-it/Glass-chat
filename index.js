const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// 1. DATABASE CONNECTIONS
const MONGO_URI = "mongodb+srv://admin:44CE0VlDDcTosDn3@cluster800.mh0idmx.mongodb.net/?appName=Cluster800";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

const Message = mongoose.model('Message', new mongoose.Schema({
    room: String,
    sender: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
}));

// 2. PERSON STORAGE
const dbPath = path.join(__dirname, 'users.json');
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, '[]');
let users = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));

// 3. ROUTES (Fixes "Cannot GET" errors)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));

app.post('/signup', (req, res) => {
    const { user, phone, pass, pfp } = req.body;
    if (users.find(u => u.user === user || u.phone === phone)) return res.status(400).send("Taken");
    const newUser = { user, phone, pass, pfp, contacts: [] };
    users.push(newUser);
    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

app.post('/login', (req, res) => {
    const match = users.find(u => u.user === req.body.user && u.pass === req.body.pass);
    if (match) res.json(match);
    else res.status(401).send("Invalid");
});

// 4. SOCKET LOGIC
let onlineUsers = {};
io.on('connection', (socket) => {
    socket.on('login', (data) => {
        socket.username = data.user;
        onlineUsers[data.user] = { socketId: socket.id, ...data };
        const myData = users.find(u => u.user === data.user);
        const myContacts = users.filter(u => myData.contacts.includes(u.user));
        socket.emit('load-my-contacts', myContacts);
    });

    socket.on('request-contact', (data) => {
        const target = Object.values(onlineUsers).find(u => u.phone === data.targetPhone);
        if (target) io.to(target.socketId).emit('contact-invite', { from: data.fromUser });
    });

    socket.on('accept-contact', (data) => {
        const me = users.find(u => u.user === data.from);
        const them = users.find(u => u.user === data.to);
        if (me && them) {
            if (!me.contacts.includes(them.user)) me.contacts.push(them.user);
            if (!them.contacts.includes(me.user)) them.contacts.push(me.user);
            fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
            if (onlineUsers[me.user]) io.to(onlineUsers[me.user].socketId).emit('contact-added', them);
            if (onlineUsers[them.user]) io.to(onlineUsers[them.user].socketId).emit('contact-added', me);
        }
    });

    socket.on('load-history', async (data) => {
        const room = [data.from, data.to].sort().join('-');
        const history = await Message.find({ room }).sort({ timestamp: 1 }).limit(100);
        socket.emit('chat-history', history);
    });

    socket.on('send-private-msg', async (data) => {
        const room = [data.from, data.to].sort().join('-');
        await new Message({ room, sender: data.from, text: data.text }).save();
        if (onlineUsers[data.to]) io.to(onlineUsers[data.to].socketId).emit('receive-msg', data);
        socket.emit('receive-msg', data);
    });

    socket.on('disconnect', () => { delete onlineUsers[socket.username]; });
});

http.listen(process.env.PORT || 3000);
