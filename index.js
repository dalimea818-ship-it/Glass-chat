const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const mongoose = require('mongoose');

// DATABASE
const MONGO_URI = "mongodb+srv://admin:44CE0VlDDcTosDn3@cluster800.mh0idmx.mongodb.net/?appName=Cluster800";
mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB Live")).catch(err => console.log(err));

const User = mongoose.model('User', new mongoose.Schema({
    user: String, phone: String, pass: String, pfp: String, contacts: [String]
}));
const Message = mongoose.model('Message', new mongoose.Schema({
    room: String, sender: String, text: String, fileType: String, fileName: String, timestamp: { type: Date, default: Date.now }
}));

// Payload limits increased for .mp4 and large files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '100mb' })); 

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));

app.post('/signup', async (req, res) => {
    const { user, phone, pass, pfp } = req.body;
    const exists = await User.findOne({ $or: [{ user }, { phone }] });
    if (exists) return res.status(400).send("Taken");
    await new User({ user, phone, pass, pfp, contacts: [] }).save();
    res.sendStatus(200);
});

app.post('/login', async (req, res) => {
    const match = await User.findOne({ user: req.body.user, pass: req.body.pass });
    if (match) res.json(match); else res.status(401).send("Invalid");
});

let onlineUsers = {};
io.on('connection', (socket) => {
    socket.on('login', async (data) => {
        socket.username = data.user;
        onlineUsers[data.user] = { socketId: socket.id, ...data };
        const myData = await User.findOne({ user: data.user });
        const friends = await User.find({ user: { $in: myData.contacts } });
        socket.emit('load-my-contacts', friends);
    });

    socket.on('get-online-users', () => {
        const list = Object.values(onlineUsers).filter(u => u.user !== socket.username)
            .map(u => ({ user: u.user, pfp: u.pfp, phone: u.phone }));
        socket.emit('online-list', list);
    });

    socket.on('request-contact', (data) => {
        const target = Object.values(onlineUsers).find(u => u.phone === data.targetPhone);
        if (target) io.to(target.socketId).emit('contact-invite', { from: data.fromUser });
    });

    socket.on('accept-contact', async (data) => {
        await User.updateOne({ user: data.from }, { $addToSet: { contacts: data.to } });
        await User.updateOne({ user: data.to }, { $addToSet: { contacts: data.from } });
        const them = await User.findOne({ user: data.to });
        const me = await User.findOne({ user: data.from });
        if (onlineUsers[me.user]) io.to(onlineUsers[me.user].socketId).emit('contact-added', them);
        if (onlineUsers[them.user]) io.to(onlineUsers[them.user].socketId).emit('contact-added', me);
    });

    socket.on('send-private-msg', async (data) => {
        const room = [data.from, data.to].sort().join('-');
        await new Message(data).save(); // Saves text, fileType, and fileName
        if (onlineUsers[data.to]) io.to(onlineUsers[data.to].socketId).emit('receive-msg', data);
        socket.emit('receive-msg', data);
    });

    socket.on('rtc-signal', (data) => {
        const target = onlineUsers[data.to];
        if (target) io.to(target.socketId).emit('rtc-signal', { from: socket.username, signal: data.signal });
    });

    socket.on('disconnect', () => delete onlineUsers[socket.username]);
});

http.listen(process.env.PORT || 3000);
