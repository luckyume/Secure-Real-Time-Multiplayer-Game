'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e5 });
const PORT = process.env.PORT || 3000;
const WORLD = { width: 2400, height: 1600 };
const players = new Map();
const FOOD_COUNT = 42;
let food = [];

// Explicit hardening for the FreeCodeCamp security requirements.
app.use(helmet.noCache());
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.disable('x-powered-by');
app.use((_req, res, next) => { res.setHeader('X-Powered-By', 'PHP 7.4.3'); next(); });
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false, maxAge: 0, setHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
} }));
app.get('/game-config', (_req, res) => {
  res.set({ 'X-Powered-By': 'PHP 7.4.3', 'Cache-Control': 'no-store' });
  res.json({ world: WORLD });
});

function randomFood() {
  return { id: Math.random().toString(36).slice(2), x: 45 + Math.random() * (WORLD.width - 90), y: 45 + Math.random() * (WORLD.height - 90), value: 1 + (Math.random() < 0.12 ? 2 : 0) };
}
food = Array.from({ length: FOOD_COUNT }, randomFood);
function cleanName(value) {
  if (typeof value !== 'string') return 'Player';
  return value.replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 18) || 'Player';
}
function snapshot() {
  return { players: Array.from(players.values()).map(({ id, name, x, y, score, color }) => ({ id, name, x, y, score, color })), food, world: WORLD };
}

io.on('connection', (socket) => {
  const colors = ['#63e6be', '#ffca7a', '#a78bfa', '#ff7c8a', '#7dd3fc', '#f9a8d4'];
  players.set(socket.id, { id: socket.id, name: 'Player', x: 120 + Math.random() * (WORLD.width - 240), y: 120 + Math.random() * (WORLD.height - 240), score: 0, color: colors[Math.floor(Math.random() * colors.length)], input: { up: false, down: false, left: false, right: false } });
  socket.emit('init', { id: socket.id, ...snapshot() });
  socket.on('join', (name) => { const p = players.get(socket.id); if (p) p.name = cleanName(name); });
  socket.on('input', (input) => {
    const p = players.get(socket.id);
    if (!p || !input || typeof input !== 'object') return;
    p.input = { up: input.up === true, down: input.down === true, left: input.left === true, right: input.right === true };
  });
  socket.on('disconnect', () => { players.delete(socket.id); });
});

const SPEED = 230;
let previous = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  for (const p of players.values()) {
    let dx = Number(p.input.right) - Number(p.input.left);
    let dy = Number(p.input.down) - Number(p.input.up);
    const length = Math.hypot(dx, dy) || 1;
    p.x = Math.max(22, Math.min(WORLD.width - 22, p.x + (dx / length) * SPEED * dt));
    p.y = Math.max(22, Math.min(WORLD.height - 22, p.y + (dy / length) * SPEED * dt));
    for (let i = food.length - 1; i >= 0; i--) {
      if (Math.hypot(p.x - food[i].x, p.y - food[i].y) < 30) {
        p.score += food[i].value;
        food[i] = randomFood();
        io.emit('collect', { id: p.id, foodId: food[i].id });
      }
    }
  }
  io.volatile.emit('state', snapshot());
}, 50);

if (require.main === module) server.listen(PORT, () => console.log(`Game server listening on ${PORT}`));
module.exports = { app, server };
