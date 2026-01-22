const express = require("express");
const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =======================
// MIDDLEWARE
// =======================
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// =======================
// MONGODB
// =======================
mongoose.connect(
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/glasspro"
);

mongoose.connection.once("open", () =>
  console.log("✅ MongoDB Connected")
);

// =======================
// SCHEMAS
// =======================
const User = mongoose.model("User", new mongoose.Schema({
  user: { type: String, unique: true },
  phone: { type: String, unique: true },
  pass: String,
  pfp: String,
  contacts: { type: [String], default: [] }
}));

const Message = mongoose.model("Message", new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  timestamp: { type: Date, default: Date.now }
}));

// =======================
// ROUTES
// =======================
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

app.get("/chat", (_, res) =>
  res.sendFile(path.join(__dirname, "public/chat.html"))
);

// =======================
// SIGNUP (FIXED)
// =======================
app.post("/signup", async (req, res) => {
  try {
    const { user, phone, pass, pfp } = req.body;

    if (!user || !phone || !pass)
      return res.sendStatus(400);

    const exists = await User.findOne({
      $or: [{ user }, { phone }]
    });

    if (exists)
      return res.sendStatus(409);

    await User.create({
      user,
      phone,
      pass,
      pfp,
      contacts: []
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// =======================
// LOGIN
// =======================
app.post("/login", async (req, res) => {
  const { user, pass } = req.body;

  const u = await User.findOne({ user, pass });
  if (!u) return res.sendStatus(401);

  res.json(u);
});

// =======================
// SOCKET.IO
// =======================
const online = {};

io.on("connection", socket => {

  socket.on("login", async me => {
    socket.user = me.user;
    online[me.user] = socket.id;

    const dbUser = await User.findOne({ user: me.user });
    const contacts = await User.find({ user: { $in: dbUser.contacts } });

    socket.emit("load-my-contacts", contacts);
    io.emit("online-list", Object.keys(online).map(u => ({ user: u })));
  });

  socket.on("send-private-msg", async d => {
    await Message.create(d);

    if (online[d.to])
      io.to(online[d.to]).emit("receive-msg", d);

    socket.emit("receive-msg", d);
  });

  socket.on("load-history", async d => {
    const msgs = await Message.find({
      $or: [
        { from: d.from, to: d.to },
        { from: d.to, to: d.from }
      ]
    }).sort({ timestamp: 1 });

    msgs.forEach(m => socket.emit("receive-msg", m));
  });

  socket.on("request-contact", async d => {
    await User.updateOne(
      { user: d.fromUser },
      { $addToSet: { contacts: d.targetPhone } }
    );
  });

  socket.on("disconnect", () => {
    delete online[socket.user];
    io.emit("online-list", Object.keys(online).map(u => ({ user: u })));
  });
});

// =======================
// START
// =======================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("🚀 Server running on", PORT)
);