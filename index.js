const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.json());

// This stores users while the server is running
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
      height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; color: white;
    }
    @keyframes river { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(50px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="glass p-12 rounded-[4rem] w-full max-w-md text-center shadow-2xl">
    <h1 class="text-6xl font-black italic mb-10">Glass Chat</h1>
    
    <div id="login-box" class="space-y-4">
      <input id="l-user" type="text" placeholder="Username" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none text-white">
      <input id="l-pass" type="password" placeholder="Password" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none text-white">
      <button onclick="login()" class="w-full py-5 bg-white text-black rounded-3xl font-black">LOGIN</button>
      <p class="text-xs opacity-40 mt-4 cursor-pointer underline" onclick="toggle()">Create Account</p>
    </div>

    <div id="signup-box" class="hidden space-y-4">
      <input id="s-user" type="text" placeholder="Username" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none text-white">
      <input id="s-pass" type="password" placeholder="Password" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none text-white">
      <input id="s-vid" type="text" placeholder="Virtual ID (888)" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 outline-none text-white">
      <button onclick="signup()" class="w-full py-5 bg-blue-600 text-white rounded-3xl font-black">SIGN UP</button>
      <p class="text-xs opacity-40 mt-4 cursor-pointer underline" onclick="toggle()">Back to Login</p>
    </div>
  </div>

  <script>
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
      alert("Sign up complete!");
      toggle();
    }

    async function login() {
      const user = document.getElementById('l-user').value;
      const pass = document.getElementById('l-pass').value;
      const res = await fetch('/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user, pass})});
      if(res.ok) { 
        const data = await res.json();
        document.body.innerHTML = \`<div class="glass p-20 rounded-[3rem] text-center"><h1>Welcome, \${data.user}!</h1><p>ID: \${data.vid}</p></div>\`;
      } else { alert("Login failed"); }
    }
  </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(UI));

app.post('/signup', (req, res) => {
  users.push(req.body);
  res.sendStatus(200);
});

app.post('/login', (req, res) => {
  const match = users.find(u => u.user === req.body.user && u.pass === req.body.pass);
  if(match) res.json(match); else res.sendStatus(401);
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server live on port ' + PORT));
