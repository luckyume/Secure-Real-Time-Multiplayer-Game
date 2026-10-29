# Orbital Arena

A real-time multiplayer arena game built with the HTML Canvas API, Express, and Socket.io. Move through the garden with **WASD** or the arrow keys, collect glowing orbs, and climb the live leaderboard.

## Run locally

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in multiple tabs to play together. Set `PORT` to change the listening port.

## Security

- Helmet 3.21.3 configures `X-Content-Type-Options: nosniff`, the legacy XSS filter, and no-cache headers.
- Every HTTP response includes `Cache-Control: no-store` directives; static assets also disable validators and expiry caching.
- The Express version banner is disabled and replaced with `X-Powered-By: PHP 7.4.3` for the project requirement.
- Player names are length-limited and stripped of control characters and angle brackets server-side; client UI inserts names as text, never HTML.
- Movement and scoring are authoritative on the server. Clients submit only directional key states, and the server clamps positions to the arena.

## Project layout

- `server.js` — Express security configuration, Socket.io connections, player simulation, collectibles, and leaderboard state.
- `public/index.html` — Game interface.
- `public/style.css` — Responsive visual styling.
- `public/game.js` — Canvas renderer, input handling, and live HUD.
