const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

/**
 * 1. SERVER CONFIGURATION
 * We set the 'public' folder as the home for our HTML, JS, and Manifest files.
 * We increase the JSON limit so profile pictures don't get "cut off".
 */
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

/**
 * 2. DATABASE SYSTEM
 * This looks for 'users.json'. If it doesn't exist, it creates an empty list.
 */
let users = [];
const dbPath = path.join(__dirname, 'users.json');

const loadDB = () => {
    if (fs.existsSync(dbPath)) {
        try {
            users = JSON.parse(fs.readFileSync(dbPath));
        } catch (e) {
            console.error("Database corrupted. Starting fresh.");
            users = [];
        }
    }
};
loadDB();

/**
 * 3. PAGE ROUTES
 * These tell the server exactly which file to show for each URL.
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html')); // Login/Signup
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(publicPath, 'chat.html')); // Main Chat UI
});

// PWA & Service Worker Routes
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(publicPath, 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(publicPath, 'manifest.json'));
});

/**
 * 4. AUTHENTICATION API
 */
app.post('/signup', (req, res) => {
    const { user, pass, vid, pfp } = req.body;
    if (users.find(u => u.user === user)) {
        return res.status(409).send("User already exists");
    }
    users.push({ user, pass, vid, pfp });
    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
    res.sendStatus(200);
});

app.post('/login', (req, res) => {
    const match = users.find(u => u.user === req.body.user && u.pass === req.body.pass);
    if (match) {
        res.json(match);
    } else {
        res.status(401).send("Invalid credentials");
    }
});

/**
 * 5. REAL-TIME SOCKET LOGIC
 * Handles Global Chat, Online Status, and Call Requests.
 */
let onlineUsers = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a user logs in, store their details and notify everyone
    socket.on('login', (userData) => {
        socket.username = userData.user;
        onlineUsers[userData.user] = {
            socketId: socket.id,
            user: userData.user,
            vid: userData.vid,
            pfp: userData.pfp
        };
        io.emit('update-online', Object.values(onlineUsers));
    });

    // Handle Global Messages
    socket.on('send-msg', (data) => {
        // data contains { user, text, pfp, media }
        io.emit('receive-msg', data);
    });

    // Handle Call Signaling (Ringing)
    socket.on('call-request', (data) => {
        const target = onlineUsers[data.to];
        if (target) {
            io.to(target.socketId).emit('incoming-call', data);
        }
    });

    // Handle Call Rejection/End
    socket.on('call-rejected', (data) => {
        const target = onlineUsers[data.to];
        if (target) {
            io.to(target.socketId).emit('stop-ringing');
        }
    });

    // Clean up when a user closes the app
    socket.on('disconnect', () => {
        if (socket.username) {
            delete onlineUsers[socket.username];
            io.emit('update-online', Object.values(onlineUsers));
        }
        console.log('User disconnected');
    });
});

/**
 * 6. START THE SERVER
 */
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Glass Pro Server is LIVE`);
    console.log(`📱 Port: ${PORT}`);
    console.log(`=================================`);
});
