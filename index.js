const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

const onlineUsers = new Map(); // username -> socket.id

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  socket.on("login", user => {
    socket.username = user.user;
    onlineUsers.set(user.user, socket.id);

    io.emit("online-users", Array.from(onlineUsers.keys()));
  });

  socket.on("join-room", ({ me, other }) => {
    const room = [me, other].sort().join("-");
    socket.join(room);
  });

  socket.on("send-msg", data => {
    const room = [data.from, data.to].sort().join("-");
    io.to(room).emit("receive-msg", data);
  });

  // ---------- WEBRTC ----------
  socket.on("call-user", ({ to, from, signal }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target).emit("incoming-call", { from, signal });
    }
  });

  socket.on("answer-call", ({ to, signal }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target).emit("call-answered", signal);
    }
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target).emit("ice-candidate", candidate);
    }
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.username);
    io.emit("online-users", Array.from(onlineUsers.keys()));
  });
});

server.listen(3000, () => console.log("Server running"));