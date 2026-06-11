# Beanie — V5 Plan

V5 ships **online multiplayer**: real humans playing each other anywhere in the world via shared 4-digit room codes. V3 ([plan-v3.md](plan-v3.md)) is assumed shipped (Easy/Medium/Hard AI tiers live in production). V4 ([plan-v4.md](plan-v4.md)) is **independent of V5** — they can ship in either order.

Inspired by the room-code flow at https://www.mindmeld.lol/ — create a room, share the code, friends join, host clicks Start.

---

## 1. Scope

In scope for V5:

1. **Room creation & joining** — host generates a 4-digit code; up to 4 players join by entering it from anywhere.
2. **Real-time game sync** — every move (`DRAW`, `TAKE_DISCARD`, `PLAY_SET`, `START_REARRANGE`, `COMMIT_REARRANGE`, `DISCARD`) is server-authoritative and broadcast to all players.
3. **Lobby UI** — list of joined players, host start button, copyable room code.
4. **Disconnect/reconnect** — short-window reconnect (~60s) using a session ID in `localStorage`.
5. **Hand redaction** — server strips opponent hand contents before broadcasting state per-player; UI sees opponent hands as count-only.

Out of scope for V5:

- **AI seats in multiplayer rooms** — humans only. Future feature.
- **Spectators** — no observer mode.
- **Accounts / persistent profiles** — display name only, no auth.
- **Cross-room matchmaking / public lobbies** — code-share only.
- **In-game chat / emotes** — defer.
- **Persistent game history** — rooms are ephemeral.
- **Mobile push notifications** — defer.

---

## 2. Architecture

### 2.1 Server: PartyKit (Cloudflare Durable Objects)

One Durable Object per active room. The 4-digit code **is** the object name. Server code is TypeScript and **imports the existing pure engine** from `src/engine/` — no re-implementation, no drift risk.

```
party/
├── server.ts                (PartyKit room handler)
├── room-state.ts            (per-room state machine: lobby | playing | ended)
├── redact.ts                (strip opponent hand contents for broadcasts)
└── messages.ts              (typed client↔server protocol)
```

Why PartyKit:
- **Room = first-class concept.** Each Durable Object isolates one game; no shared global state to manage.
- **TypeScript native.** Server imports `applyAction`, `createInitialState`, types — zero duplication with `src/engine/`.
- **Free tier covers hobby usage** comfortably (100k req/day, 1GB transfer/mo).
- **Deploys with `npx partykit deploy`**; URL goes into a Vite env var.

### 2.2 Protocol

Messages are JSON, typed in `party/messages.ts`. Client → server:

```ts
type ClientMessage =
  | { type: 'HELLO'; sessionId: string; displayName: string }
  | { type: 'START_GAME' }                              // host only
  | { type: 'GAME_ACTION'; action: EngineAction }       // applyAction input
  | { type: 'REQUEST_REMATCH' }                         // host only
  | { type: 'LEAVE' };
```

Server → client (broadcast unless noted):

```ts
type ServerMessage =
  | { type: 'LOBBY_STATE'; players: LobbyPlayer[]; hostId: string; code: string }
  | { type: 'GAME_STATE'; state: RedactedGameState }    // sent per-player (private)
  | { type: 'ERROR'; message: string }                  // per-player
  | { type: 'ROOM_CLOSED'; reason: string };
```

`RedactedGameState` is `GameState` with opponent hands replaced by `{ id, hidden: true }` placeholders so card counts and IDs match but suits/ranks are stripped.

### 2.3 Authoritative state

The server owns canonical `GameState`. Clients send `EngineAction` intents; server validates the sender is the current player, calls `applyAction`, broadcasts the new state (redacted per-recipient). Invalid intents return `ERROR` to the sender only.

This means **the entire AI/game logic stays in `src/engine/`** — the server is a thin transport + validation layer.

---

## 3. Game Flow (UX)

### 3.1 Title screen update

Add a second primary button below "New game":

```
        beanie
   [Players] [2] [3] [4]
   [Difficulty] [Easy] [Medium] [Hard]
   [ New game ]              ← existing local-vs-AI
   [ Play with friends ]     ← NEW
   How to play
```

### 3.2 Multiplayer entry flow

**"Play with friends" → menu screen:**
```
   [ Create room ]
   [ Join room ]
   [ ← back ]
```

**Create room:**
1. Enter display name (max 16 chars; preserved in `localStorage`).
2. Click "Create" → server returns 4-digit code.
3. Land in lobby as host.

**Join room:**
1. Enter display name.
2. Enter 4-digit code.
3. Click "Join" → server attaches to existing room, or shows error if room not found / full / already started.
4. Land in lobby as non-host.

### 3.3 Lobby

```
   Room code: 4729   [Copy]

   Players (3/4):
     • You (Dan)             host
     • Aria
     • Bo
     [ + waiting... ]

   [ Start game ]            ← enabled when ≥2 players, host only
   [ Leave room ]
```

- Host sees an enabled Start button when 2+ players joined.
- Non-hosts see "Waiting for host to start…"
- Room code is one-tap copyable.
- Disconnected players show a greyed "(disconnected)" status; auto-removed after 60s.

### 3.4 In-game

Identical to single-player `GameBoard` — same UI, same drag/drop, same rearrange flow. The only differences:
- Opponents are real humans (display names instead of "Aria/Bo/Cleo").
- State updates arrive via WebSocket instead of local store dispatch.
- "Your turn" indicator becomes critical (you're waiting for real humans, not instant AI).

### 3.5 End-of-game

```
   Aria wins! 🎉
   [ Rematch ]      ← host only, returns lobby with same players
   [ Leave ]
```

---

## 4. File Structure

```
party/                                NEW — PartyKit server
├── server.ts
├── room-state.ts
├── redact.ts
├── messages.ts
└── __tests__/
    ├── room-state.test.ts
    └── redact.test.ts

src/
├── multiplayer/                      NEW — client transport
│   ├── client.ts                     (PartyKit client wrapper, ws lifecycle)
│   ├── session.ts                    (localStorage sessionId/displayName)
│   ├── store.ts                      (zustand mp store — lobby + connection state)
│   └── __tests__/
│       └── client.test.ts
├── ui/
│   ├── Title.tsx                     (MODIFIED — add "Play with friends" button)
│   ├── MultiplayerMenu.tsx           (NEW — Create / Join screen)
│   ├── CreateRoomScreen.tsx          (NEW — name entry + create)
│   ├── JoinRoomScreen.tsx            (NEW — name + code entry + join)
│   ├── LobbyScreen.tsx               (NEW — player list + start button)
│   └── GameBoard.tsx                 (MODIFIED — read from mp store when in mp game)
├── store/
│   └── gameStore.ts                  (MODIFIED — mode flag: 'local' | 'mp')
└── App.tsx                           (MODIFIED — route based on app phase)

partykit.json                         NEW — PartyKit deploy config
.env.local                            NEW — VITE_PARTYKIT_HOST (gitignored)
.env.example                          NEW — template
```

Engine and existing AI files are **unchanged**.

---

## 5. State Management

A new top-level "app phase" lives in `App.tsx` / a small app-store:

```ts
type AppPhase =
  | { kind: 'title' }
  | { kind: 'localGame' }                // existing single-player flow
  | { kind: 'mpMenu' }
  | { kind: 'mpCreate' }
  | { kind: 'mpJoin' }
  | { kind: 'mpLobby'; code: string }
  | { kind: 'mpGame'; code: string }
  | { kind: 'mpEnded'; code: string };
```

The existing `gameStore.ts` continues to drive **local single-player games** unchanged. A parallel `multiplayer/store.ts` holds:
- `code: string | null`
- `players: LobbyPlayer[]`
- `selfId: string`
- `hostId: string`
- `connectionStatus: 'connecting' | 'open' | 'reconnecting' | 'closed'`
- `state: GameState | null` (server-redacted)

`GameBoard` reads from whichever store is active based on `AppPhase`.

---

## 6. Hidden-Info Handling (Redaction)

Currently the engine state has every player's hand fully visible (single-player needs this for AI). For multiplayer:

```ts
// party/redact.ts
function redactFor(state: GameState, viewerId: PlayerId): RedactedGameState {
  return {
    ...state,
    players: state.players.map(p =>
      p.id === viewerId
        ? p
        : { ...p, hand: p.hand.map(c => ({ id: c.id, hidden: true })) }
    ),
  };
}
```

UI changes are minimal — opponent hands are already rendered as backs. We just teach `CardView` to render a back when `card.hidden === true`. The discard pile, table sets, and draw pile counts are public information, so no redaction there.

---

## 7. Disconnect / Reconnect

- On WS open, client sends `HELLO` with a `sessionId` from `localStorage` (generated on first multiplayer use, persists forever).
- Server tracks `sessionId → seat` mapping. If a HELLO arrives matching a seat marked `disconnected`, that seat resumes.
- On WS close, server marks the seat `disconnected` and starts a 60-second timer. If the player reconnects in time, timer is cancelled. If it expires:
  - In lobby: seat is removed.
  - In game: seat is removed; if the game becomes < 2 humans, end the game with a "player disconnected" notice. If it was the disconnected player's turn, server auto-discards their lowest-value card to keep the game flowing? **→ open question, see §11.**

- Page refresh = WS close + reopen → automatic reconnect within the 60s window.

---

## 8. Testing Strategy

### 8.1 Engine
No engine changes. Existing 72 tests must remain green.

### 8.2 Server (party/__tests__/)
- `room-state.test.ts` — lobby join/leave transitions; host promotion if host leaves; max-4 enforced; can't join started/ended room.
- `redact.test.ts` — `redactFor` strips only non-self hands; preserves IDs and lengths; doesn't mutate input.
- Action validation: only current player's `GAME_ACTION` is applied; out-of-turn actions return `ERROR`.

### 8.3 Client (src/multiplayer/__tests__/)
- `client.test.ts` with a mocked WS — reconnects on close, replays HELLO, updates store on incoming messages.
- Session ID persists across mount/unmount.

### 8.4 Integration (manual + optional Playwright)
- Two browser windows: create room in one, join in the other, play a full game.
- Refresh during game → both clients reconnect → game continues.
- Close one tab → other client sees "disconnected" status → after 60s, game ends gracefully.

---

## 9. Build Phases

Each phase is a runnable, demoable state. Don't skip ahead.

### Phase 0 — Pre-conditions
- Confirm 72-test baseline green on `main`.
- Branch `v5-multiplayer` off `main`.
- Sign up for PartyKit (free) and run `npx partykit init` to scaffold `party/`.

### Phase 1 — Server scaffold + room lifecycle (1.5 days)
- Implement `party/server.ts` + `room-state.ts`.
- 4-digit code generation with collision check.
- HELLO / LOBBY_STATE / LEAVE messages.
- Local dev: `npx partykit dev` running alongside Vite.
- Tests for `room-state.ts`.

### Phase 2 — Multiplayer client transport (1 day)
- `src/multiplayer/client.ts` + `session.ts` + `store.ts`.
- Connects to local PartyKit dev server.
- No UI yet — verify via console / browser devtools that two clients can join the same room and see each other in the lobby.

### Phase 3 — Lobby UI (1 day)
- `MultiplayerMenu`, `CreateRoomScreen`, `JoinRoomScreen`, `LobbyScreen`.
- Title screen "Play with friends" button.
- Two browser windows: create + join + see each other.

### Phase 4 — In-game sync + redaction (1.5 days)
- Server wires `applyAction` + per-player redaction.
- `GameBoard` reads from `multiplayer/store.ts` when in mp game.
- `CardView` renders back when `hidden: true`.
- Two browsers play a full game end-to-end.

### Phase 5 — Disconnect/reconnect (1 day)
- Session ID in `localStorage`.
- Server-side 60s reconnect window.
- "Disconnected" indicator in lobby + game.
- Page refresh resumes seat.

### Phase 6 — End-of-game + rematch + polish (½ day)
- `EndGameModal` adapts for mp (winner display name, host-only rematch).
- Rematch button → reset to lobby with same players.
- Empty-state and error toasts.

### Phase 7 — Deploy (½ day)
- `npx partykit deploy` → get production URL.
- `VITE_PARTYKIT_HOST` env var in Vercel project settings.
- Smoke test against production from two networks (e.g. desktop + phone-on-4G).
- Update README with multiplayer feature.

**Total estimate: ~7 working days.**

---

## 10. Decisions Already Made

1. **PartyKit** as the server stack (Cloudflare Durable Objects, room-per-object model). Server imports the existing engine — no logic duplication.
2. **Humans only** in multiplayer rooms for V5; AI seats deferred.
3. **4-digit numeric codes** (10,000 codespace; expire idle rooms after 1 hour; collision-check on create).
4. **Anonymous play** — display name only, no accounts. `sessionId` in `localStorage` for reconnect.
5. **Server-authoritative** state with per-player redaction. Clients send action intents, never raw state.
6. **Reuse `GameBoard` and engine code unchanged.** Only the data source switches between local store and mp store.

---

## 11. Open Questions / Decisions Deferred

Track in `notes.txt` if these come up during build:

- **Stuck turn on disconnect:** if it's the disconnected player's turn and they don't reconnect within 60s, do we (a) auto-discard a low-value card to keep the game flowing, (b) end the game, or (c) skip to next player and forfeit them? **Lean (b) ending the game cleanly** — feels right for hobby use; auto-discard is hidden-info-aware and adds complexity.
- **Room code lifetime:** how long do empty rooms (no players) survive before garbage collection? **Lean 5 minutes** after last player leaves.
- **Profanity filter for display names:** out of scope, but flag if it bites.
- **Game settings carry over from title?** Current title screen sets player count + difficulty. For multiplayer there's no AI difficulty, and player count is determined by who joins. Title settings should be ignored in mp flow. **Confirm during Phase 3 UI design.**
- **Mid-game join:** disallowed in V5. Room becomes "in progress" on Start and rejects new HELLOs from new session IDs.
- **Multiple games per lobby:** rematch (§3.5) reuses the lobby. Does the host reset settings? **No settings in mp lobby for V5 — just Start.**

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| PartyKit free tier exhausted | Hobby-scale; if it grows, paid tier is cheap. Worst case, migrate to self-hosted Node WS — protocol is stack-agnostic. |
| Engine drift between client and server | Server imports `src/engine/` directly via TS path — same code, no possible drift. |
| Latency feels bad on slow networks | Client renders optimistically for own actions, snaps to server state on response. Lobby UI has explicit "connecting/reconnecting" indicators. |
| Cheating via DevTools | Server is authoritative; clients only send intents. Worst a client can do is send invalid `GAME_ACTION`s, which return `ERROR`. Hidden info never leaves the server for non-self players. |
| 4-digit codespace collisions at scale | 10k codes × 1hr TTL handles thousands of concurrent rooms. If it ever bites, bump to 5-digit. |

---

## 13. File Change Summary

**New:**
- `party/server.ts`, `room-state.ts`, `redact.ts`, `messages.ts`
- `party/__tests__/room-state.test.ts`, `redact.test.ts`
- `src/multiplayer/client.ts`, `session.ts`, `store.ts`
- `src/multiplayer/__tests__/client.test.ts`
- `src/ui/MultiplayerMenu.tsx`, `CreateRoomScreen.tsx`, `JoinRoomScreen.tsx`, `LobbyScreen.tsx`
- `partykit.json`, `.env.example`

**Modified:**
- `src/ui/Title.tsx` (add "Play with friends" button)
- `src/ui/GameBoard.tsx` (data source switch)
- `src/ui/CardView.tsx` (render back when `hidden: true`)
- `src/ui/EndGameModal.tsx` (rematch button for mp)
- `src/store/gameStore.ts` (no-op for mp games, or add mode flag)
- `src/App.tsx` (route on AppPhase)
- `package.json` (`partykit`, `partysocket` deps; `mp:dev`, `mp:deploy` scripts)
- `README.md` (multiplayer feature + setup notes)

**Unchanged:**
- Everything under `src/engine/` and `src/ai/`.
- All V2 / V3 features.
