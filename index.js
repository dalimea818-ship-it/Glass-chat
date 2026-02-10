const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Ensure upload directory exists so server doesn't crash
const UPLOAD_PATH = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_PATH)) {
    fs.mkdirSync(UPLOAD_PATH);
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ DB Connected"))
    .catch(err => console.error("❌ DB Fail:", err.message));

// Models
const User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }
}));

const File = mongoose.model('File', new mongoose.Schema({
    name: String,
    path: String,
    date: { type: Date, default: Date.now }
}));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// Upload API
const upload = multer({ dest: 'uploads/' });
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });
        const newFile = new File({ name: req.file.originalname, path: req.file.path });
        await newFile.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Upload crash" });
    }
});

// File List API (Prevents "Error connecting to server")
app.get('/api/files', async (req, res) => {
    try {
        const files = await File.find();
        res.json(files);
    } catch (err) {
        res.status(500).json([]);
    }
});

app.listen(PORT, () => console.log(`🚀 Live on ${PORT}`));
