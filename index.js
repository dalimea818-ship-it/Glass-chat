const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.use(express.json());

// Persistent Database Logic
let users = [];
const dbPath = './users.json';
if (fs.existsSync(dbPath)) {
    users = JSON.parse(fs.readFileSync(dbPath));
}

const UI = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes rainbow { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
    body { 
      margin:0; background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab); 
      background-size: 400% 400%; animation: river 15s ease infinite, rainbow 20s linear infinite; 
      height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; color: white; overflow: hidden;
    }
    @keyframes river { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    .glass { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.2); }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div id="auth-screen" class="glass p-12 rounded-[3.5rem] w-full max-w-md text-center shadow-2xl">
    <h1 class="text-5xl font-black italic mb-10">Glass Pro</h1>
    
    <div id="login-box" class="space-y-4">
      <input id="l-user" placeholder="Username" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10 text-white">
      <input id="l-pass" type="password" placeholder="Password" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10 text-white">
      <button onclick="login()" class="w-full py-5 bg-white text-black rounded-3xl font-black text-xl hover:scale-105 transition">LOGIN</button>
      <button onclick="showSignup()" class="w-full py-3 bg-white/5 rounded-2xl text-xs font-bold border border-white/10 mt-4">CREATE NEW ACCOUNT</button>
    </div>

    <div id="signup-box" class="hidden space-y-4">
      <input id="s-user" placeholder="New Username" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10 text-white">
      <input id="s-pass" type="password" placeholder="New Password" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10 text-white">
      <input id="s-vid" placeholder="Virtual ID (888)" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10 text-white">
      <button onclick="signup()" class="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xl">SIGN UP</button>
      <button onclick="showLogin()" class="w-full py-3 opacity-50 text-xs font-bold mt-4">BACK TO LOGIN</button>
    </div>
  </div>

  <div id="chat-screen" class="hidden glass w-full max-w-6xl h-[90vh] rounded-[4rem] flex overflow-hidden">
    <div class="w-72 border-r border-white/10 p-8 flex flex-col bg-black/20">
      <div class="mb-10">
        <h2 id="display-name" class="text-2xl font-black italic"></h2>
        <p id="display-id" class="text-[10px] tracking-widest opacity-40 uppercase font-bold"></p>
      </div>
      <button onclick="startCall()" class="w-full p-4 bg-green-500/20 rounded-2xl text-[10px] font-black tracking-widest mb-4">📞 VOICE CALL</button>
      <div class="flex-1"></div>
      <button onclick="location.reload()" class="text-[10px] font-bold opacity-30 hover:opacity-100 uppercase tracking-widest">Logout</button>
    </div>
    
    <div class="flex-1 flex flex-col p-8">
      <div id="messages" class="flex-1 overflow-y-auto space-y-4 pr-4"></div>
      <div class="mt-6 flex flex-col gap-3">
        <div id="preview" class="hidden h-24 w-24 rounded-2xl border-2 border-white/20 bg-center bg-cover"></div>
        <div class="flex gap-4 bg-white/5 p-3 rounded-[2.5rem] border border-white/10 shadow-inner">
          <label class="p-4 cursor-pointer hover:bg-white/10 rounded-full transition">
            📎 <input type="file" id="file-input" class="hidden" onchange="handleFile(this)">
          </label>
          <input id="msg-input" placeholder="Message..." class="flex-1 bg-transparent p-4 outline-none text-white font-medium">
          <button onclick="sendMsg()" class="bg-white text-black px-12 rounded-[2rem] font-black hover:scale-105 transition">SEND</button>
        </div>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let currentUser = "";
    let mediaData = null;

    function showSignup() {
      document.getElementById('login-box').classList.add('hidden');
      document.getElementById('signup-box').classList.remove('hidden');
    }
    function showLogin() {
      document.getElementById('signup-box').classList.add('hidden');
      document.getElementById('login-box').classList.remove('hidden');
    }

    async function signup() {
      const user = document.getElementById('s-user').value;
      const pass = document.getElementById('s-pass').value;
      const vid = document.getElementById('s-vid').value;
      const res = await fetch('/signup', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user, pass, vid})
      });
      if(res.ok) { alert("Account Created!"); showLogin(); }
    }

    async function login() {
      const user = document.getElementById('l-user').value;
      const pass = document.getElementById('l-pass').value;
      const res = await fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user, pass})
      });
      if(res.ok) {
        const data = await res.json();
        currentUser = data.user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('chat-screen').classList.remove('hidden');
        document.getElementById('display-name').innerText = data.user;
        document.getElementById('display-id').innerText = "ID: " + data.vid;
      } else { alert("Login failed! Check credentials."); }
    }

    function handleFile(input) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        mediaData = { type: file.type.split('/')[0], data: e.target.result };
        const prev = document.getElementById('preview');
        prev.style.backgroundImage = \`url(\${e.target.result})\`;
        prev.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }

    function sendMsg() {
      const input = document.getElementById('msg-input');
      if(input.value || mediaData) {
        socket.emit('msg', { user: currentUser, text: input.value, media: mediaData });
        input.value = "";
        mediaData = null;
        document.getElementById('preview').classList.add('hidden');
      }
    }

    socket.on('msg', (msg) => {
      const div = document.createElement('div');
      div.className = "p-5 rounded-[2rem] max-w-[75%] " + (msg.user === currentUser ? "ml-auto bg-white text-black shadow-xl" : "bg-white/10");
      let content = \`<b>\${msg.user}:</b><br>\${msg.text}\`;
      if(msg.media) {
        if(msg.media.type === 'image') content += \`<img src="\${msg.media.data}" class="mt-3 rounded-xl max-h-64 shadow-lg">\`;
        if(msg.media.type === 'video') content += \`<video src="\${msg.media.data}" controls class="mt-3 rounded-xl max-h-64 shadow-lg"></video>\`;
      }
      div.innerHTML = content;
      document.getElementById('messages').appendChild(div);
      document.getElementById('messages').scrollTop = 99999;
    });

    function startCall() { alert("Voice call initiated..."); }
  </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(UI));

app.post('/signup', (req, res) => {
  users.push(req.body);
  fs.writeFileSync(dbPath, JSON.stringify(users));
  res.sendStatus(200);
});

app.post('/login', (req, res) => {
  const match = users.find(u => u.user === req.body.user && u.pass === req.body.pass);
  if(match) res.json(match); else res.sendStatus(401);
});

io.on('connection', (socket) => {
  socket.on('msg', (data) => io.emit('msg', data));
});

http.listen(process.env.PORT || 3000);
