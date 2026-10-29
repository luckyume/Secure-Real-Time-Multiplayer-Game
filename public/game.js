(() => {
  'use strict';
  const canvas = document.getElementById('arena');
  const ctx = canvas.getContext('2d');
  const socket = io({ transports: ['websocket', 'polling'] });
  const state = { id: null, players: [], food: [], world: { width: 2400, height: 1600 }, joined: false, keys: {}, particles: [], camera: { x: 0, y: 0 }, lastCollect: 0 };
  const scoreEl = document.getElementById('score');
  const leaderboardEl = document.getElementById('leaderboard');
  const welcome = document.getElementById('welcome');
  const nameInput = document.getElementById('player-name');
  const connectionLabel = document.getElementById('connection-label');
  const onlineCount = document.getElementById('online-count');
  let width = 0, height = 0, dpr = 1, toastTimer;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const me = () => state.players.find(p => p.id === state.id);
  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); width = canvas.clientWidth; height = canvas.clientHeight; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  window.addEventListener('resize', resize); resize();
  socket.on('connect', () => { connectionLabel.textContent = 'LIVE'; connectionLabel.style.color = '#75dda8'; });
  socket.on('disconnect', () => { connectionLabel.textContent = 'RECONNECTING'; connectionLabel.style.color = '#efb071'; });
  socket.on('init', data => { state.id = data.id; state.players = data.players; state.food = data.food; state.world = data.world; updateHud(); });
  socket.on('state', data => { state.players = data.players; state.food = data.food; state.world = data.world; updateHud(); });
  socket.on('collect', data => {
    if (data.id === state.id) { const p = me(); burst(p?.x || width / 2, p?.y || height / 2); showToast('ORB SECURED  +1'); }
  });
  document.getElementById('join-form').addEventListener('submit', event => { event.preventDefault(); const name = nameInput.value.trim().replace(/[<>\u0000-\u001f\u007f]/g, '').slice(0, 18); if (!name) return; socket.emit('join', name); state.joined = true; welcome.classList.add('hidden'); nameInput.blur(); });
  document.getElementById('help-button').addEventListener('click', () => { showToast('MOVE WITH WASD OR ARROW KEYS'); });
  function showToast(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1400); }
  function updateHud() {
    onlineCount.textContent = state.players.length;
    const player = me(); scoreEl.textContent = String(player?.score || 0).padStart(3, '0');
    const ranked = [...state.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 5);
    leaderboardEl.replaceChildren(...ranked.map((p, i) => {
      const row = document.createElement('li'); row.className = 'leader-row';
      const rank = document.createElement('span'); rank.className = `rank${i === 0 ? ' top' : ''}`; rank.textContent = String(i + 1).padStart(2, '0');
      const label = document.createElement('span'); label.className = 'player-label'; label.textContent = p.name;
      const score = document.createElement('span'); score.className = 'row-score'; score.textContent = p.score;
      row.append(rank, label); if (p.id === state.id) { const you = document.createElement('span'); you.className = 'you-tag'; you.textContent = 'YOU'; row.append(you); } row.append(score); return row;
    }));
  }
  const keyMap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  window.addEventListener('keydown', e => { if (keyMap[e.key] && state.joined) { e.preventDefault(); state.keys[keyMap[e.key]] = true; } });
  window.addEventListener('keyup', e => { if (keyMap[e.key]) state.keys[keyMap[e.key]] = false; });
  window.addEventListener('blur', () => { state.keys = {}; });
  setInterval(() => { if (socket.connected) socket.emit('input', state.keys); }, 50);
  function worldToScreen(x, y) { return { x: x - state.camera.x, y: y - state.camera.y }; }
  function drawBackground() {
    ctx.fillStyle = '#0a1519'; ctx.fillRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(width * .52, height * .48, 40, width * .52, height * .48, Math.max(width, height) * .78);
    gradient.addColorStop(0, '#142722'); gradient.addColorStop(.55, '#0d1b1c'); gradient.addColorStop(1, '#091216'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    const step = 64, ox = -state.camera.x % step, oy = -state.camera.y % step;
    ctx.strokeStyle = 'rgba(144,202,164,.055)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = ox; x < width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = oy; y < height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); } ctx.stroke();
    // Subtle distant garden lights add depth without obscuring the playfield.
    for (let i = 0; i < 22; i++) { const x = ((i * 397 + 81) % state.world.width) - state.camera.x, y = ((i * 263 + 53) % state.world.height) - state.camera.y; if (x > -30 && x < width + 30 && y > -30 && y < height + 30) { ctx.fillStyle = 'rgba(93,184,135,.035)'; ctx.beginPath(); ctx.arc(x, y, 13 + (i % 4) * 4, 0, Math.PI * 2); ctx.fill(); } }
  }
  function drawFood(item, time) {
    const pos = worldToScreen(item.x, item.y); if (pos.x < -20 || pos.x > width + 20 || pos.y < -20 || pos.y > height + 20) return;
    const pulse = 1 + Math.sin(time / 280 + item.x) * .13, radius = item.value > 1 ? 7 : 5.5;
    const glow = ctx.createRadialGradient(pos.x, pos.y, 1, pos.x, pos.y, radius * 3.5); glow.addColorStop(0, item.value > 1 ? 'rgba(255,202,122,.45)' : 'rgba(111,245,181,.4)'); glow.addColorStop(1, 'rgba(111,245,181,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(pos.x, pos.y, radius * 3.5 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = item.value > 1 ? '#ffd08e' : '#92f4bd'; ctx.beginPath(); ctx.arc(pos.x, pos.y, radius * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(pos.x - 1.5, pos.y - 1.5, radius * .24, 0, Math.PI * 2); ctx.fill();
  }
  function drawPlayer(p, time) {
    const pos = worldToScreen(p.x, p.y); if (pos.x < -70 || pos.x > width + 70 || pos.y < -70 || pos.y > height + 70) return;
    const radius = p.id === state.id ? 18 : 16, pulse = 1 + Math.sin(time / 400 + p.x) * .035;
    const glow = ctx.createRadialGradient(pos.x, pos.y, radius * .2, pos.x, pos.y, radius * 2.8); glow.addColorStop(0, `${p.color}55`); glow.addColorStop(1, `${p.color}00`); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(pos.x, pos.y, radius * 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b1717'; ctx.beginPath(); ctx.arc(pos.x, pos.y + 3, radius * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.color; ctx.lineWidth = p.id === state.id ? 2 : 1.5; ctx.beginPath(); ctx.arc(pos.x, pos.y, radius * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = p.color; ctx.globalAlpha = .18; ctx.beginPath(); ctx.arc(pos.x, pos.y, radius - 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#eaf5eb'; ctx.beginPath(); ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = '11px "DM Sans", sans-serif'; ctx.fillStyle = '#d6e5dc'; ctx.shadowColor = '#08120f'; ctx.shadowBlur = 6; ctx.fillText(p.name, pos.x, pos.y - radius - 10); ctx.shadowBlur = 0;
  }
  function burst(x, y) { for (let i = 0; i < 11; i++) { const a = Math.random() * Math.PI * 2, speed = 30 + Math.random() * 90; state.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .55, max: .55 }); } }
  function drawParticles(dt) { for (let i = state.particles.length - 1; i >= 0; i--) { const p = state.particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) { state.particles.splice(i, 1); continue; } const pos = worldToScreen(p.x, p.y); ctx.globalAlpha = p.life / p.max; ctx.fillStyle = '#9ff7c3'; ctx.beginPath(); ctx.arc(pos.x, pos.y, 2.4 * (p.life / p.max), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    const player = me(); if (player) { state.camera.x = clamp(player.x - width / 2, 0, Math.max(0, state.world.width - width)); state.camera.y = clamp(player.y - height / 2, 0, Math.max(0, state.world.height - height)); }
    drawBackground(); state.food.forEach(f => drawFood(f, now)); state.players.slice().sort((a, b) => a.y - b.y).forEach(p => drawPlayer(p, now)); drawParticles(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
