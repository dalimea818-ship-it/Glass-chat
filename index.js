const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const mongoose = require('mongoose');

// 1. DATABASE CONNECTION
const MONGO_URI = "mongodb+srv://admin:44CE0VlDDcTosDn3@cluster800.mh0idmx.mongodb.net/?appName=Cluster800";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// 2. DATABASE MODELS
const User = mongoose.model('User', new mongoose.Schema({
    user: String, 
    phone: String, 
    pass: String, 
    pfp: String, 
    contacts: [String] // Array of usernames
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    room: String, 
    sender: String, 
    text: String, 
    timestamp: { type: Date, default: Date.now }
}));

// 3. MIDDLEWARE & STATIC FILES
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));

// 4. ROUTES (Fixes the "Cannot GET /chat" error)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// 5. AUTHENTICATION
app.post('/signup', async (req, res) => {
    try {
        const { user, phone, pass, pfp } = req.body;
        const exists = await User.findOne({ $or: [{ user }, { phone }] });
        if (exists) return res.status(400).send("User already exists");
        
        const newUser = new User({ user, phone, pass, pfp, contacts: [] });
        await newUser.save();
        res.sendStatus(200);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/login', async (req, res) => {
    const match = await User.findOne({ user: req.body.user, pass: req.body.pass });
    if (match) res.json(match); 
    else res.status(401).send("Invalid credentials");
});

// 6. REAL-TIME LOGIC
let onlineUsers = {};
io.on('connection', (socket) => {
    
    socket.on('login', async (data) => {
        socket.username = data.user;
        onlineUsers[data.user] = { socketId: socket.id, ...data };
        
        // Load friend list from DB
        const myData = await User.findOne({ user: data.user });
        if(myData) {
            const myFriends = await User.find({ user: { $in: myData.contacts } });
            socket.emit('load-my-contacts', myFriends);
        }
    });

    socket.on('get-online-users', () => {
        const list = Object.values(onlineUsers)
            .filter(u => u.user !== socket.username)
            .map(u => ({ user: u.user, pfp: u.pfp, phone: u.phone }));
        socket.emit('online-list', list);
    });

    socket.on('request-contact', (data) => {
        const target = Object.values(onlineUsers).find(u => u.phone === data.targetPhone);
        if (target) io.to(target.socketId).emit('contact-invite', { from: data.fromUser });
    });

    socket.on('accept-contact', async (data) => {
        // Save friendship in DB permanently
        await User.updateOne({ user: data.from }, { $addToSet: { contacts: data.to } });
        await User.updateOne({ user: data.to }, { $addToSet: { contacts: data.from } });
        
        const them = await User.findOne({ user: data.to });
        const me = await User.findOne({ user: data.from });
        
        if (onlineUsers[me.user]) io.to(onlineUsers[me.user].socketId).emit('contact-added', them);
        if (onlineUsers[them.user]) io.to(onlineUsers[them.user].socketId).emit('contact-added', me);
    });

    socket.on('rtc-signal', (data) => {
        const target = onlineUsers[data.to];
        if (target) io.to(target.socketId).emit('rtc-signal', { from: socket.username, signal: data.signal });
    });

    socket.on('send-private-msg', async (data) => {
        const room = [data.from, data.to].sort().join('-');
        const msg = new Message({ room, sender: data.from, text: data.text });
        await msg.save();
        
        if (onlineUsers[data.to]) io.to(onlineUsers[data.to].socketId).emit('receive-msg', data);
        socket.emit('receive-msg', data);
    });

    socket.on('load-history', async (data) => {
        const room = [data.from, data.to].sort().join('-');
        const history = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
        socket.emit('chat-history', history);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.username];
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
