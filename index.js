const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.use(express.json({limit: '50mb'})); // Increased limit for profile pictures

let users = [];
const dbPath = './users.json';
if (fs.existsSync(dbPath)) {
    users = JSON.parse(fs.readFileSync(dbPath));
}

// Keep track of who is actually online right now
let onlineUsers = {}; 

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
    .avatar-circle {
      width: 100px; height: 100px; border-radius: 50%;
      background: rgba(255,255,255,0.2); display: flex; align-items: center;
      justify-content: center; margin: 0 auto 20px; cursor: pointer;
      position: relative; border: 2px dashed rgba(255,255,255,0.4);
      overflow: hidden;
    }
    .avatar-circle img { width: 100%; height: 100%; object-fit: cover; }
    .contact-card { transition: all 0.3s ease; border: 1px solid transparent; }
    .contact-card:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div id="auth-screen" class="glass p-12 rounded-[3.5rem] w-full max-w-md text-center shadow-2xl">
    <h1 class="text-5xl font-black italic mb-10">Glass Pro</h1>
    <div id="login-box" class="space-y-4">
      <input id="l-user" placeholder="Username" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10">
      <input id="l-pass" type="password" placeholder="Password" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10">
      <button onclick="login()" class="w-full py-5 bg-white text-black rounded-3xl font-black text-xl">LOGIN</button>
      <button onclick="showSignup()" class="w-full py-3 bg-white/5 rounded-2xl text-xs font-bold border border-white/10 mt-4 uppercase">Create Account</button>
    </div>
    <div id="signup-box" class="hidden space-y-4">
      <div class="avatar-circle" onclick="document.getElementById('pfp-input').click()">
        <div id="plus-sym" class="text-4xl font-bold">+</div>
        <img id="pfp-preview" class="hidden">
      </div>
      <input type="file" id="pfp-input" class="hidden" accept="image/*" onchange="previewPFP(this)">
      <input id="s-user" placeholder="Username" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10">
      <input id="s-pass" type="password" placeholder="Password" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10">
      <input id="s-vid" placeholder="Virtual ID (888)" class="w-full p-5 rounded-2xl bg-white/10 outline-none border border-white/10">
      <button onclick="signup()" class="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xl">SIGN UP</button>
      <button onclick="showLogin()" class="w-full py-3 opacity-50 text-xs font-bold">Back</button>
    </div>
  </div>

  <div id="chat-screen" class="hidden glass w-full max-w-6xl h-[90vh] rounded-[4rem] flex overflow-hidden">
    <div class="w-80 border-r border-white/10 flex flex-col bg-black/30">
      <div class="p-8 border-b border-white/10">
        <div class="flex items-center gap-4">
          <img id="my-pfp" class="w-12 h-12 rounded-full border-2 border-white/40 object-cover">
          <div>
            <h2 id="my-name" class="font-black italic"></h2>
            <p id="my-id" class="text-[10px] opacity-40 uppercase"></p>
          </div>
        </div>
      </div>
      
      <div class="p-4 uppercase text-[10px] font-black tracking-[0.2em] opacity-30 mt-4 ml-4">Contacts Online</div>
      <div id="contact-list" class="flex-1 overflow-y-auto p-4 space-y-2">
        </div>
      
      <button onclick="location.reload()" class="p-8 text-[10px] font-black opacity-30 hover:opacity-100 uppercase transition">Logout</button>
    </div>

    <div class="flex-1 flex flex-col p-10">
       <div id="messages" class="flex-1 overflow-y-auto space-y-4 pr-4"></div>
       <div class="mt-6 flex gap-3 bg-white/5 p-2 rounded-full border border-white/10">
         <input id="msg-input" placeholder="Message..." class="flex-1 bg-transparent p-4 outline-none">
         <button onclick="sendMsg()" class="bg-white text-black px-10 rounded-full font-black">SEND</button>
       </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let me = null;
    let selectedPFP = "";

    function showSignup() { document.getElementById('login-box').classList.add('hidden'); document.getElementById('signup-box').classList.remove('hidden'); }
    function showLogin() { document.getElementById('signup-box').classList.add('hidden'); document.getElementById('login-box').classList.remove('hidden'); }

    function previewPFP(input) {
      const reader = new FileReader();
      reader.onload = (e) => {
        selectedPFP = e.target.result;
        document.getElementById('pfp-preview').src = selectedPFP;
        document.getElementById('pfp-preview').classList.remove('hidden');
        document.getElementById('plus-sym').classList.add('hidden');
      };
      reader.readAsDataURL(input.files[0]);
    }

    async function signup() {
      const user = document.getElementById('s-user').value;
      const pass = document.getElementById('s-pass').value;
      const vid = document.getElementById('s-vid').value;
      await fetch('/signup', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user, pass, vid, pfp: selectedPFP})
      });
      alert("Sign Up Success!"); showLogin();
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
        me = await res.json();
        socket.emit('login', me); // Tell server we are online
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('chat-screen').classList.remove('hidden');
        document.getElementById('my-name').innerText = me.user;
        document.getElementById('my-id').innerText = "ID: " + me.vid;
        document.getElementById('my-pfp').src = me.pfp || '';
      } else { alert("Login failed!"); }
    }

    function sendMsg() {
      const input = document.getElementById('msg-input');
      if(input.value) {
        socket.emit('msg', { user: me.user, text: input.value, pfp: me.pfp });
        input.value = "";
      }
    }

    // UPDATE CONTACT LIST
    socket.on('update-contacts', (usersOnline) => {
      const list = document.getElementById('contact-list');
      list.innerHTML = "";
      Object.values(usersOnline).forEach(u => {
        if(u.user === me.user) return; // Don't show myself in contacts
        const card = document.createElement('div');
        card.className = "contact-card flex items-center gap-3 p-3 rounded-2xl cursor-pointer";
        card.innerHTML = \`
          <img src="\${u.pfp || ''}" class="w-10 h-10 rounded-full border border-white/20 object-cover">
          <div>
            <p class="text-sm font-bold">\${u.user}</p>
            <p class="text-[9px] opacity-40 uppercase">ID: \${u.vid}</p>
          </div>
          <div class="ml-auto w-2 h-2 bg-green-400 rounded-full shadow-[0_0_8px_#4ade80]"></div>
        \`;
        list.appendChild(card);
      });
    });

    socket.on('msg', (msg) => {
      const div = document.createElement('div');
      div.className = "flex items-center gap-3 " + (msg.user === me.user ? "flex-row-reverse" : "");
      div.innerHTML = \`
        <img src="\${msg.pfp || ''}" class="w-8 h-8 rounded-full border border-white/10 object-cover">
        <div class="p-4 rounded-2xl \${msg.user === me.user ? 'bg-white text-black' : 'bg-white/10'} max-w-sm">
          <p class="text-[10px] opacity-40 font-bold uppercase mb-1">\${msg.user}</p>
          \${msg.text}
        </div>\`;
      document.getElementById('messages').appendChild(div);
      document.getElementById('messages').scrollTop = 99999;
    });
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
  socket.on('login', (userData) => {
    onlineUsers[socket.id] = userData;
    io.emit('update-contacts', onlineUsers);
  });

  socket.on('msg', (data) => io.emit('msg', data));

  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    io.emit('update-contacts', onlineUsers);
  });
});

http.listen(process.env.PORT || 3000);
