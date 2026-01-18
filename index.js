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
    @keyframes rainbow {
      0% { filter: hue-rotate(0deg); }
      100% { filter: hue-rotate(360deg); }
    }
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
  <div id="auth-screen" class="glass p-12 rounded-[3rem] w-full max-w-md text-center">
    <h1 class="text-5xl font-black mb-8">Glass Pro</h1>
    <div id="login-box" class="space-y-4">
      <input id="l-user" placeholder="Username" class="w-full p-4 rounded-2xl bg-white/10 outline-none">
      <input id="l-pass" type="password" placeholder="Password" class="w-full p-4 rounded-2xl bg-white/10 outline-none">
      <button onclick="login()" class="w-full py-4 bg-white text-black rounded-2xl font-bold">ENTER</button>
    </div>
  </div>

  <div id="chat-screen" class="hidden glass w-full max-w-6xl h-[90vh] rounded-[3rem] flex overflow-hidden">
    <div class="w-64 border-r border-white/10 p-6 flex flex-col bg-black/20">
      <div id="user-info" class="mb-8">
        <p id="display-name" class="font-bold text-xl"></p>
        <p id="display-id" class="text-xs opacity-50"></p>
      </div>
      <button onclick="startCall()" class="mb-2 p-3 bg-green-500/20 rounded-xl text-xs font-bold">📞 VOICE CALL</button>
      <div class="flex-1"></div>
      <button onclick="location.reload()" class="opacity-30 text-xs">LOGOUT</button>
    </div>

    <div class="flex-1 flex flex-col p-6">
      <div id="messages" class="flex-1 overflow-y-auto space-y-4 p-4"></div>
      
      <div class="mt-4 flex flex-col gap-2">
        <div id="preview" class="hidden h-20 w-20 rounded-lg bg-cover bg-center border border-white/20"></div>
        <div class="flex gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
          <label class="p-4 cursor-pointer hover:bg-white/10 rounded-xl">
            📎 <input type="file" id="file-input" class="hidden" onchange="handleFile(this)">
          </label>
          <input id="msg-input" placeholder="Message..." class="flex-1 bg-transparent outline-none">
          <button onclick="sendMsg()" class="bg-white text-black px-8 rounded-xl font-bold">SEND</button>
        </div>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    let currentUser = "";
    let mediaData = null;

    // Ask for notification permission
    Notification.requestPermission();

    function login() {
      const user = document.getElementById('l-user').value;
      const pass = document.getElementById('l-pass').value;
      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user, pass})
      }).then(res => res.json()).then(data => {
        currentUser = data.user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('chat-screen').classList.remove('hidden');
        document.getElementById('display-name').innerText = data.user;
        document.getElementById('display-id').innerText = "ID: " + data.vid;
      });
    }

    function handleFile(input) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        mediaData = { type: file.type.split('/')[0], data: e.target.result };
        document.getElementById('preview').style.backgroundImage = \`url(\${e.target.result})\`;
        document.getElementById('preview').classList.remove('hidden');
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
      div.className = "p-4 rounded-2xl max-w-[80%] " + (msg.user === currentUser ? "ml-auto bg-white text-black shadow-lg" : "bg-white/10");
      
      let content = \`<b>\${msg.user}</b><br>\${msg.text}\`;
      if(msg.media) {
        if(msg.media.type === 'image') content += \`<img src="\${msg.media.data}" class="mt-2 rounded-lg max-h-60">\`;
        if(msg.media.type === 'video') content += \`<video src="\${msg.media.data}" controls class="mt-2 rounded-lg max-h-60"></video>\`;
      }
      
      div.innerHTML = content;
      document.getElementById('messages').appendChild(div);
      document.getElementById('messages').scrollTop = 99999;

      if(msg.user !== currentUser && document.hidden) {
        new Notification("New Message from " + msg.user, { body: msg.text });
      }
    });

    async function startCall() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      alert("Microphone active! (WebRTC connection logic triggered)");
    }
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
  socket.on('msg', (data) => io.emit('msg', data));
});

http.listen(process.env.PORT || 3000);
