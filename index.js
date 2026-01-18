const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.json());
let users = []; 

const UI = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { 
      margin:0; background: linear-gradient(-45deg, #020617, #1e1b4b, #312e81, #020617); 
      background-size: 400% 400%; animation: river 12s ease infinite; 
      height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; color: white; overflow: hidden;
    }
    @keyframes river { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(50px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div id="auth-screen" class="glass p-12 rounded-[4rem] w-full max-w-md text-center shadow-2xl">
    <h1 class="text-6xl font-black italic mb-10">Glass Chat</h1>
    <div id="login-box" class="space-y-4">
      <input id="l-user" type="text" placeholder="Username" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none">
      <input id="l-pass" type="password" placeholder="Password" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none">
      <button onclick="login()" class="w-full py-5 bg-white text-black rounded-3xl font-black">LOGIN</button>
      <p class="text-xs opacity-40 mt-4 cursor-pointer underline" onclick="toggle()">Create Account</p>
    </div>
    <div id="signup-box" class="hidden space-y-4">
      <input id="s-user" type="text" placeholder="Username" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none">
      <input id="s-pass" type="password" placeholder="Password" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none">
      <input id="s-vid" type="text" placeholder="Virtual ID (888)" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none">
      <button onclick="signup()" class="w-full py-5 bg-blue-600 text-white rounded-3xl font-black">SIGN UP</button>
      <p class="text-xs opacity-40 mt-4 cursor-pointer underline" onclick="toggle()">Back</p>
    </div>
  </div>

  <div id="chat-screen" class="hidden glass w-full max-w-6xl h-[85vh] rounded-[4rem] flex overflow-hidden">
    <div class="w-72 border-r border-white/5 p-8 flex flex-col bg-black/20">
      <h2 id="display-name" class="text-[10px] font-black tracking-widest opacity-30 mb-2 uppercase italic"></h2>
      <h2 id="display-id" class="text-[10px] font-black tracking-widest opacity-30 mb-8 uppercase"></h2>
      <div class="flex-1"></div>
      <button onclick="location.reload()" class="text-[10px] font-bold opacity-30 hover:opacity-100 transition">LOGOUT</button>
    </div>
    <div class="flex-1 flex flex-col p-10">
      <div id="messages" class="flex-1 overflow-y-auto space-y-4"></div>
      <div class="mt-8 flex gap-4 bg-white/5 p-2 rounded-[2.5rem] border border-white/10">
        <input id="msg-input" placeholder="Type a message..." class="flex-1 bg-transparent p-5 outline-none text-white">
        <button onclick="sendMsg()" class="bg-white text-black px-10 rounded-[2rem] font-black">SEND</button>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let currentUser = "";

    function toggle() {
      document.getElementById('login-box').classList.toggle('hidden');
      document.getElementById('signup-box').classList.toggle('hidden');
    }

    async function signup() {
      const data = { 
        user: document.getElementById('s-user').value,
        pass: document.getElementById('s-pass').value,
        vid: document.getElementById('s-vid').value
      };
      await fetch('/signup', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
      alert("Success! Now login.");
      toggle();
    }

    async function login() {
      const user = document.getElementById('l-user').value;
      const pass = document.getElementById('l-pass').value;
      const res = await fetch('/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user, pass})});
      if(res.ok) { 
        const data = await res.json();
        currentUser = data.user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('chat-screen').classList.remove('hidden');
        document.getElementById('display-name').innerText = "User: " + data.user;
        document.getElementById('display-id').innerText = "ID: " + data.vid;
      } else { alert("Login failed"); }
    }

    function sendMsg() {
      const input = document.getElementById('msg-input');
      if(input.value) {
        socket.emit('chat message', { user: currentUser, text: input.value });
        input.value = "";
      }
    }

    socket.on('chat message', (msg) => {
      const div = document.createElement('div');
      div.className = "p-4 bg-white/10 rounded-2xl max-w-[70%] " + (msg.user === currentUser ? "ml-auto bg-white text-black" : "");
      div.innerHTML = \`<b>\${msg.user}:</b> \${msg.text}\`;
      document.getElementById('messages').appendChild(div);
    });
  </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(UI));
app.post('/signup', (req, res) => { users.push(req.body); res.sendStatus(200); });
app.post('/login', (req, res) => {
  const match = users.find(u => u.user === req.body.user && u.pass === req.body.pass);
  if(match) res.json(match); else res.sendStatus(401);
});

io.on('connection', (socket) => {
  socket.on('chat message', (msg) => io.emit('chat message', msg));
});

http.listen(process.env.PORT || 3000);
