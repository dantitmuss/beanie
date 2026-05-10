# beanie

A browser-based card game — 1 human player vs 1–3 AI opponents. Loosely based on Gin Rummy.

## Running locally

```
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

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
  ai/           Medium AI player
  store/        Zustand store and rearrange state
  ui/           React components
  lib/          PRNG, ID helpers, classnames
```
