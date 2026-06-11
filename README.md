# beanie

A browser-based card game — play solo against 1–3 AI opponents, or online with friends via shared room codes. Loosely based on Gin Rummy.

## Running locally

```
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

To use multiplayer locally, also run the PartyKit dev server in a second terminal:

```
npm run mp:dev
```

The client defaults to `localhost:1999` when `VITE_PARTYKIT_HOST` is unset (see `.env.example`). Open two browser tabs, click **Play with friends**, create a room in one and join with the code in the other.

## Multiplayer (V5)

- **Play with friends** on the title screen → create a room (4-digit code) or join one.
- Up to 4 players per room; the host starts the game once 2+ have joined.
- The server is authoritative: clients send action intents, the PartyKit server validates them against the engine in `src/engine/` (imported directly — no duplicated rules) and broadcasts per-player **redacted** state. Opponent hands, the draw pile, and the RNG seed never leave the server, so DevTools can't reveal hidden cards.
- Dropped connections get a 60-second reconnect window (page refresh resumes your seat). If a player leaves a running game for good, the game ends for everyone.
- Rematch returns the same lobby for another round.

### Deploying multiplayer

```
npx partykit login     # once
npm run mp:deploy      # prints your https://beanie.<user>.partykit.dev URL
```

Then set `VITE_PARTYKIT_HOST=beanie.<user>.partykit.dev` in the environment used to build the static bundle (e.g. Vercel project settings or `.env.local`), rebuild, and deploy as usual.

## Running tests

```
npm test
```

## Building for production

```
npm run build
```

Outputs a static bundle to `dist/`.

## Deploying (Nginx)

```
sudo cp -r dist/* /var/www/beanie/
```

Nginx site config:

```nginx
server {
  listen 80;
  server_name beanie.example.com;
  root /var/www/beanie;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
  location ~* \.(js|css|svg|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }
}
```

Add HTTPS with Let's Encrypt (`certbot --nginx`) before pointing real users at it.

## What's new in V2

- **Bigger cards** — suit glyphs scaled up ~30% so they're readable on mobile without zooming.
- **Hand reorder** — long-press (mobile) or drag (desktop) any card in your hand to rearrange it. Order persists across engine updates within a game; tap-to-select still works normally.
- **Discard pile viewer** — tap the card count below the discard pile to open a scrollable modal showing all discarded cards, most recent first.
- **Rearrange bug fix** — creating a new set from multiple selected hand cards in rearrange mode now places all cards correctly into one set (previously only the first card was placed; the rest silently misrouted).

## Tech stack

- **Vite + React 18 + TypeScript** (strict)
- **Zustand** for state management
- **Tailwind CSS** for styling
- **dnd-kit** for drag-and-drop (touch-friendly)
- **Vitest** for tests

## Project structure

```
src/
  engine/       Pure game logic — no React, no DOM, fully tested
  ai/           Easy/Medium/Hard AI players
  multiplayer/  PartySocket client, session identity, multiplayer store
  store/        Zustand store and rearrange state
  ui/           React components
  lib/          PRNG, ID helpers, classnames
party/          PartyKit server (room lifecycle, action validation, redaction)
scripts/        AI tuning + multiplayer smoke test (scripts/mp-smoke.ts)
```
