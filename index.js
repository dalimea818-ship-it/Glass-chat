const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

const onlineUsers = new Map();

io.on("connection", socket => {

  socket.on("login", user => {
    socket.username = user.user;
    onlineUsers.set(user.user, socket.id);
    io.emit("online-users", [...onlineUsers.keys()]);
  });

  socket.on("join-room", ({ me, other }) => {
    socket.join([me, other].sort().join("-"));
  });

  socket.on("send-msg", d => {
    io.to([d.from, d.to].sort().join("-")).emit("receive-msg", d);
  });

  // --- WEBRTC ---
  socket.on("call-user", d => {
    const id = onlineUsers.get(d.to);
    if (id) io.to(id).emit("incoming-call", d);
  });

  socket.on("answer-call", d => {
    const id = onlineUsers.get(d.to);
    if (id) io.to(id).emit("call-answered", d.signal);
  });

  socket.on("ice-candidate", d => {
    const id = onlineUsers.get(d.to);
    if (id) io.to(id).emit("ice-candidate", d.candidate);
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.username);
    io.emit("online-users", [...onlineUsers.keys()]);
  });
});

server.listen(3000, () => console.log("🚀 Server running"));