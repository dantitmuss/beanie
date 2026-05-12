# Beanie — Browser Card Game: Build Plan

A single-page, browser-based implementation of **Beanie**, a Gin Rummy–derived card game. The player plays against 1–3 AI opponents on one device. Static-deployable for hosting on a VPS.

This document is the implementation brief. Read it end-to-end before coding.

---

## 1. Product Summary

- **Players:** 1 human + 1, 2, or 3 AI opponents (selectable on the title screen).
- **Difficulty:** Single AI difficulty — "Medium" — for v1. Hooks left in for Easy / Hard later.
- **Platform:** Single-page web app. Mobile-responsive (down to 360 px wide). No backend. No accounts. No persistence beyond the current session.
- **Aesthetic:** Plain, clean, modern, "Silicon Valley tech" — lots of whitespace, restrained typography, one accent colour, subtle motion.
- **Distribution:** Static `dist/` bundle that drops onto any VPS / Nginx / S3 / Cloudflare Pages.

The complete rules are in `Rules - final.rtf`. The plan below assumes you have read them.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Game state is intricate; type errors will kill us otherwise. |
| Build | **Vite** | Zero-config, fast HMR, single command for static build. |
| UI | **React 18** | Component model fits the multi-zone layout; ecosystem support for accessibility. |
| State | **Zustand** | Minimal global store — much simpler than Redux for this size of app. The pure game engine is the source of truth; Zustand just holds the current `GameState` snapshot and a history stack for undo. |
| Drag & drop | **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) | Best-in-class touch + pointer + keyboard support, accessible, lightweight. Works on mobile out of the box. |
| Styling | **Tailwind CSS** | Encourages the clean, utility-driven aesthetic; consistent spacing scale. |
| Tests | **Vitest** + `@testing-library/react` | Vite-native, fast, same syntax as Jest. |
| Lint / format | ESLint + Prettier | Standard. |

**No** Redux, Next.js, server, database, or auth.

---

## 3. Project Structure

```
beanie_game/
├── README.md                    (how to run / build / deploy)
├── plan.md                      (this file)
├── notes.txt                    (future ideas — keep updated)
├── Rules - final.rtf            (canonical game rules)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.cjs
├── index.html
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx                 (React root)
    ├── App.tsx                  (top-level routing: title → game)
    ├── styles/
    │   └── globals.css          (Tailwind directives + a few base rules)
    ├── engine/                  (PURE — no React, no DOM)
    │   ├── types.ts
    │   ├── deck.ts
    │   ├── sets.ts              (validity, ace-role inference)
    │   ├── rearrange.ts         (table validation, opening-set protection)
    │   ├── actions.ts           (applyAction reducer)
    │   ├── state.ts             (initialState, helpers)
    │   └── __tests__/
    │       ├── sets.test.ts
    │       ├── rearrange.test.ts
    │       └── actions.test.ts
    ├── ai/
    │   ├── medium.ts            (entry point for medium AI)
    │   ├── score.ts             (hand evaluation heuristics)
    │   ├── findSets.ts          (extract best sets from a hand)
    │   ├── tryExtend.ts         (try adding hand cards to existing table sets)
    │   └── __tests__/
    │       └── medium.test.ts
    ├── store/
    │   └── gameStore.ts         (Zustand: current state, history, dispatch)
    ├── ui/
    │   ├── Title.tsx            (title screen with player count selector)
    │   ├── GameBoard.tsx        (main scene)
    │   ├── Header.tsx           (logo, rules button, restart)
    │   ├── OpponentArea.tsx     (a single AI player's hand-back + their sets)
    │   ├── PlayerArea.tsx       (the human player's sets)
    │   ├── Hand.tsx             (the human's hand, sortable)
    │   ├── TableSet.tsx         (one set: cards in a row, droppable)
    │   ├── CardView.tsx         (renders a card; draggable; respects ace overlay)
    │   ├── CardBack.tsx         (face-down card for piles + opponent hands)
    │   ├── DrawPile.tsx
    │   ├── DiscardPile.tsx
    │   ├── ActionBar.tsx        (Draw / Take Discard / End Turn / Rearrange / Cancel / Confirm)
    │   ├── RearrangeOverlay.tsx (optional dimmed overlay when rearranging)
    │   ├── AcePicker.tsx        (modal: choose what an Ace represents)
    │   ├── RulesModal.tsx
    │   ├── EndGameModal.tsx
    │   └── Toast.tsx            (transient validation messages)
    └── lib/
        ├── id.ts                (uuid-ish helper)
        ├── rng.ts               (seedable PRNG so tests are deterministic)
        └── classnames.ts
```

---

## 4. Game Engine — Specification

The engine is **pure**: same input → same output, no React, no `Date.now()`, no `Math.random()` (use injected PRNG). This is what makes it testable and what makes the AI possible — the AI literally calls engine functions to evaluate hypotheticals.

### 4.1 Types (`engine/types.ts`)

```ts
export type Suit = '♣' | '♦' | '♥' | '♠';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;          // unique per physical card
  rank: Rank;
  suit: Suit;
}

// When an Ace sits in a set, it explicitly takes a role (per our design decision).
export interface AceRole {
  rank: Exclude<Rank, 'A'>;   // 2 through K
  suit: Suit;
}

export interface CardInSet {
  card: Card;
  aceRole?: AceRole;   // present iff card.rank === 'A'
}

export type SetKind = 'group' | 'run';

export interface CardSet {
  id: string;
  ownerId: PlayerId;   // whose area it sits in
  kind: SetKind;
  cards: CardInSet[];
}

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  isAI: boolean;
  hand: Card[];
  hasOpened: boolean;  // sticky once true — required for rearrange protection
}

export interface GameState {
  players: Player[];          // index 0 is the human
  turnOrder: PlayerId[];
  currentPlayerIdx: number;
  drawPile: Card[];
  discardPile: Card[];
  table: CardSet[];           // all sets across all players
  phase: 'awaitingDraw' | 'inTurn' | 'rearranging' | 'gameOver';
  rearrangeSnapshot?: GameState;  // for cancel
  winner?: PlayerId;
  rngSeed: number;
}
```

### 4.2 Deck (`engine/deck.ts`)

- `createDeck(): Card[]` — 52 cards with stable ids (e.g. `7♥`, `A♣`).
- `shuffle(deck, rng): Card[]` — Fisher-Yates with injected PRNG.
- `deal(deck, numPlayers, perPlayer = 9): { hands, remaining }`.

### 4.3 Set Validity (`engine/sets.ts`)

The single most important module. Every UI interaction routes through this.

```ts
isValidSet(set: CardSet, opts: { minSize: 3 | 4 }): { ok: boolean; reason?: string }
```

**Group rules:**
- All non-ace cards share a rank.
- Each effective suit (real or via `aceRole.suit`) appears at most once.
- Length 3 or 4. (The 4 suits cap groups at 4.)
- All Aces must have an `aceRole` whose rank matches the group's rank and whose suit is one not already present.

**Run rules:**
- All non-ace cards share a suit.
- Aces' `aceRole.suit` must equal the run's suit; their `aceRole.rank` must fit the sequence.
- The effective ranks form a strictly increasing consecutive sequence within `2..K` (no looping, no Ace=1, no Ace=14).
- Length ≥ 3 (or ≥ 4 for an opening set).

```ts
inferAceRoles(cards: Card[], hint?: { kind: SetKind; suit?: Suit; rank?: Rank })
  : { ok: boolean; cards: CardInSet[]; ambiguous?: AceRole[][] }
```

- For each Ace with no role yet, find an assignment that makes the set valid.
- For groups: assign Aces to the missing suits; if more than one mapping works (it shouldn't, given the rank is fixed), pick the lexicographic-smallest by suit.
- For runs: enumerate possible role sequences; if exactly one valid, return it. If multiple, return `ambiguous` so the UI can show the AcePicker.
- This function is what enables the "drop the Ace and we'll figure it out" UX while keeping the role explicit under the hood.

### 4.4 Table Validation (`engine/rearrange.ts`)

```ts
validateTable(state: GameState, opts: { activePlayerId: PlayerId, openingProtection: PlayerId[] })
  : { ok: boolean; errors: string[] }
```

Used continuously during rearrange. Returns:
- `every set is valid` — each set passes `isValidSet({ minSize: 3 })`.
- `opening protection` — every player in `openingProtection` has at least one set in their area with `cards.length ≥ 4`.
- `active player's first-ever set is ≥ 4` — if the active player has not opened, they cannot end a turn unless they finish opening with ≥4.

```ts
canCommitRearrange(prev: GameState, next: GameState, activePlayerId: PlayerId)
  : { ok: boolean; errors: string[] }
```

Same as above, plus:
- No card is on the table that wasn't on the table before, except cards from the active player's hand.
- No card from another player's hand has moved (sanity check).
- Card conservation: every card in the deck is somewhere (hand of someone, draw, discard, or table).

### 4.5 Actions (`engine/actions.ts`)

A tagged-union reducer:

```ts
type Action =
  | { type: 'DRAW' }
  | { type: 'TAKE_DISCARD' }
  | { type: 'PLAY_SET'; ownerId: PlayerId; cards: CardInSet[] }
  | { type: 'START_REARRANGE' }
  | { type: 'COMMIT_REARRANGE'; nextTable: CardSet[]; nextHand: Card[] }
  | { type: 'CANCEL_REARRANGE' }
  | { type: 'DISCARD'; cardId: string }
  | { type: 'AI_TURN' };

applyAction(state: GameState, action: Action): GameState
```

`applyAction` validates and returns a **new** state. It throws on invalid actions — the UI must prevent invalids from being dispatched.

`DISCARD`:
- Moves the chosen card to the top of the discard pile.
- If the active player's hand is now empty AND they have already opened: `winner = activePlayerId`, `phase = 'gameOver'`.
- Otherwise advance turn:
  - `currentPlayerIdx = (currentPlayerIdx + 1) % players.length`
  - `phase = 'awaitingDraw'`
- **Replenish:** if `drawPile.length === 0` after discard, shuffle current discard pile (excluding the new top card) into a new draw pile face-down. The card just discarded becomes the new discard top. Per rules: this happens at the *end* of a turn, so we apply it on transition.

`DRAW`:
- Move top of draw pile to active player's hand.
- `phase = 'inTurn'`.

`TAKE_DISCARD`:
- Move **all** cards from discard pile into active player's hand.
- `phase = 'inTurn'`.

`PLAY_SET`:
- Validate the proposed set with `isValidSet`.
- If active player hasn't opened, `cards.length ≥ 4`. After this play, set `hasOpened = true`.
- Remove cards from active player's hand. Add a new `CardSet` to `state.table`.
- If `ownerId !== activePlayerId`, the active player must have already opened.

`START_REARRANGE` / `COMMIT_REARRANGE` / `CANCEL_REARRANGE`:
- `START` snapshots the current state into `rearrangeSnapshot` and changes phase.
- `COMMIT` runs `canCommitRearrange`; if ok, replaces table + hand and clears snapshot.
- `CANCEL` restores from snapshot.

### 4.6 Determinism

All randomness flows through `lib/rng.ts` (a small mulberry32 PRNG). `GameState.rngSeed` is updated whenever a shuffle consumes the PRNG. This makes any bug reproducible from a seed.

---

## 5. AI — Medium Difficulty

The AI does not see hidden information (other players' hands, draw pile order). It uses only `GameState` projected through its own perspective.

### 5.1 Turn Algorithm

```
function takeTurn(state):
  1. Decide intake: DRAW or TAKE_DISCARD
  2. Loop: try to play sets / extend / rearrange-cheaply, until no more useful plays
  3. Choose discard
  4. Return Action[]
```

### 5.2 Step 1 — Intake

Compute `valueOf(card, hand)` for each card in `discardPile` (the bottom-up order matters less than what's in the pile, but the pile only changes by adding to top, so we evaluate as a bag here):

- **Take discard** if **any** of the following:
  - There exists a card in the pile that, combined with the AI's hand, immediately forms a playable set.
  - The pile contains ≥3 cards and ≥2 of them are "high-utility" (defined as: same rank as ≥2 of AI's hand cards, or in-suit-and-near-rank to AI's run-candidates).
  - The AI hasn't opened and the pile contains a card that completes a 4-card opening set.
- **Otherwise: DRAW.**

Heuristic budget: don't take discards that would balloon the hand past 13 cards unless it produces a winning sequence.

### 5.3 Step 2 — Find Plays

`findSets.ts` exports:

```ts
findCandidateSets(hand: Card[], minSize: number): CardSet[]
```

Greedy + small backtracking:
1. Group cards by rank → emit any group of size ≥ minSize.
2. Group by suit → for each suit, sort by rank, find consecutive runs of length ≥ minSize.
3. Try Ace placements: for each Ace in hand, attempt to use it to extend a candidate run by one (front or back, where 2-K bounds allow) or fill a gap inside a run.
4. Resolve overlapping cards by preferring the play that maximises *cards played*, breaking ties by preferring runs over groups (groups cap at 4; runs can grow).

After playing the best opening set (if not opened), iterate:
- Re-run `findCandidateSets` with `minSize: 3`.
- For each card still in hand, try `tryExtend.ts`: can it be added to any existing table set (own or others')? Aces in those sets may be replaceable by a real card from hand — emit that as a play that frees an Ace into hand.

The "Ace replacement" rule (rules §Aces, last bullet) is a real edge optimisation; implement it but only attempt it when it would let the AI play another full set.

### 5.4 Step 2.5 — Cheap Rearranges

A full rearrange search is exponential. For Medium AI, only attempt these patterns:
- **Merge two runs** in the same suit if a hand card bridges them (e.g. table has 3-4-5♥ and 7-8♥; AI holds 6♥ → merge into 3-8♥, freeing nothing but enabling the AI to play 6♥ which would otherwise be blocked by length).
- **Split a run to make a group** if doing so frees an Ace and lets the AI play more.
- **Extend with Ace replacement** (above).

If none of these patterns apply, skip rearranging.

### 5.5 Step 3 — Discard

Score each card in hand for "keep value":
- +3 if it's part of a near-set (1 away from a valid set with current hand).
- +1 for each other card in hand of the same rank.
- +1 for each other card in hand of the same suit within ±2 ranks.
- +5 if it's an Ace.
- −1 if it's been in the AI's hand for more than 3 turns (staleness; decay).

Discard the card with the **lowest** keep value. Tie-break: prefer to discard cards whose rank/suit appears most often in *visible* opponents' previous picks (basic counter-play; if a human has been taking 7s, don't discard 7s). For v1, this is optional polish — pure lowest-value is fine.

### 5.6 Step 4 — Win Check

Before discarding, check: if `hand.length === 1` AND `hasOpened`, discarding that card wins. Always take this if available.

### 5.7 AI Pacing

Don't fire AI moves instantly — that feels glitchy. Insert short delays (300–700 ms) between sub-actions so the human can see what the AI did. The store dispatches AI actions through a `setTimeout` queue.

---

## 6. UI — Layout & Interaction

### 6.1 Screens

1. **Title** — Big "beanie" wordmark. "New game" with a segmented control: 2 / 3 / 4 players. "Rules" button.
2. **Game board** — described below.
3. **End game modal** — "You won" / "<AI name> won". "Play again" button → returns to title.

### 6.2 Game Board Layout (desktop)

```
┌─────────────────────────────────────────────────────────────┐
│  beanie                                       [?]  [↺]      │  Header
├─────────────────────────────────────────────────────────────┤
│  AI 2 hand-back   AI 1 hand-back   AI 3 hand-back           │  Opponent strip (1-3 visible)
│  ┌──set──┐ ┌──set──┐               ┌──set──┐                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│           [DRAW]            [DISCARD]                       │  Centre piles
│                                                             │
│  ┌──set──┐ ┌──set──┐ ┌──set──┐                              │  Player's sets
├─────────────────────────────────────────────────────────────┤
│  ♣7  ♥3  ♥4  ♥5  ♠Q  ♦K  ♣A  …                              │  Player's hand
├─────────────────────────────────────────────────────────────┤
│  [Draw] [Take discard]  …  [End turn]   [Rearrange]         │  Action bar
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Mobile Layout (≤ 768 px)

- Opponents collapse to a horizontal scroll strip showing only avatar + card count + their sets in a compact ribbon.
- Player's sets and hand stack vertically.
- Action bar becomes a sticky bottom bar with icon-buttons.
- Card size shrinks; sets become horizontally scrollable rows.
- Tap-to-select replaces hover affordances. **Important:** all drag interactions must also be doable via taps for mobile users who find dragging fiddly.

### 6.4 Card Interactions — Two Modes

**Click/tap mode** (always on):
- Tap a card in your hand → it becomes **selected** (highlighted). Multi-tap for multi-select.
- Tap an empty slot under "Your sets" → forms a new set from selected cards (validated; if invalid, toast).
- Tap an existing set → adds selected cards to it (validated).
- Tap "Return to hand" zone (visible during rearrange) → returns selected cards to hand.

**Drag mode** (overlays click mode, doesn't replace it):
- Long-press / mousedown a card → drag.
- Drop on an existing set → add to it.
- Drop on the "new set" zone → start a new set.
- Drop on the discard pile → discard (only valid as turn-ending move).

**Mobile note:** dnd-kit handles touch events natively. We rely on it; we don't write our own pointer code. But the click/tap path is what we tell mobile users to prefer.

### 6.5 Rearrange Mode

Triggered by the "Rearrange" button in the action bar (enabled only after the player has opened, and only outside of `awaitingDraw`).

When active:
- A subtle frame appears around the entire table area.
- All sets — across all players — become drag sources.
- A "Return to hand" zone slides up next to the hand.
- Each set displays a small validity badge: ✓ if valid, ✗ with reason if not.
- Each player's area shows an "Opening" badge if they currently have a 4+ set in their area; missing the badge for a previously-opened player is a blocking error.
- The action bar shows **only** [Cancel] and [Confirm rearrange]. Confirm is disabled while any error is present, with a tooltip listing what's wrong.
- On Cancel: revert to snapshot.
- On Confirm: dispatch `COMMIT_REARRANGE`.

### 6.6 The AcePicker

When a card is dropped to form/extend a set and includes an Ace whose role is ambiguous, show a modal: "What does this Ace represent?" with the candidate (rank, suit) options as buttons. Pre-select the most likely (e.g. only valid rank if there's only one). Submit → action commits; Cancel → drop is reverted.

### 6.7 Visuals & Branding

- **Type:** `Inter` (UI) + `JetBrains Mono` (numerics on cards). Both via Google Fonts.
- **Logo:** all-lowercase wordmark `beanie` in tight Inter, with one geometric mark to its left — a filled circle with a small triangular notch at top-right (suggests a beanie cap; reads as a single tech-mark glyph). One SVG, ~24 px tall in the header.
- **Palette:**
  - Background: `#FAFAFA` (off-white)
  - Surface (cards, panels): `#FFFFFF` with `1px` border `#E4E4E7`
  - Text primary: `#0A0A0A`
  - Text secondary: `#71717A`
  - Accent (single colour, used sparingly for selected state, primary buttons): `#6366F1` (indigo-500)
  - Suit colours: `#0A0A0A` for ♣ ♠, `#DC2626` for ♥ ♦
  - Validation error: `#DC2626`
  - Validation success: `#16A34A`
- **Cards:** flat white surface, `8px` corner radius, rank in top-left + bottom-right (rotated), suit glyph centred. Aces in play show a small subscript indicator like `A→7♥` to make their role explicit. Card backs: solid indigo with the beanie mark centred.
- **Motion:** spring-style transforms on drag; fade for added/removed sets; no parallax, no flourishes. Card flip on draw: 180 ms.
- **Spacing:** Tailwind's 4 px base scale; consistent `gap-2` / `gap-4` / `gap-6` rhythm.

The brief is "boring but impeccable" — like a Linear / Vercel / Stripe surface.

---

## 7. Build Phases (Suggested Sequence)

Each phase ends in a runnable, demoable state. Don't skip ahead.

### Phase 0 — Scaffolding (½ day)
- `npm create vite@latest beanie -- --template react-ts`
- Install Tailwind, dnd-kit, Zustand, Vitest.
- Configure `tsconfig.json` strict mode.
- Set up the file structure from §3.
- Render a "beanie" placeholder.

### Phase 1 — Pure Engine (2–3 days)
- Implement `types.ts`, `deck.ts`, `sets.ts`, `actions.ts`, `state.ts`, `rearrange.ts`.
- Write thorough Vitest unit tests covering:
  - Group validity (3-card, 4-card, with Aces, with multiple Aces).
  - Run validity (3-K bounds, no looping, Ace fills gap, Ace at edge representing K).
  - Ace role inference (unambiguous case, ambiguous case).
  - Action correctness (DRAW, TAKE_DISCARD, PLAY_SET, DISCARD, win condition).
  - Rearrange validation including opening-set protection.
  - Replenish-on-empty-draw.
- **Do not move on until engine tests pass.** This is the foundation everything else stands on.

### Phase 2 — Static Game Board (2 days)
- Build all UI components with hardcoded mock state. No interactivity yet.
- Verify mobile layout at 360 / 768 / 1024 / 1440 px.
- Render cards, hand, opponents, piles, sets.

### Phase 3 — Wire Engine to UI (2 days)
- Zustand store holds `GameState`; subscribe components.
- Title screen → start game with N players.
- Implement `DRAW`, `TAKE_DISCARD`, `DISCARD` flows for human player only (no AI yet — leave AI turns as no-ops or auto-discard).
- Implement `PLAY_SET` with click/tap selection + drag-drop + AcePicker.
- Validate everything via the engine; show toast errors on invalid attempts.
- End-game modal.

### Phase 4 — Rearrange Mode (2 days)
- `START_REARRANGE` / `COMMIT_REARRANGE` / `CANCEL_REARRANGE`.
- Live validation badges on sets and player areas.
- Confirm-disabled UI when invalid.
- Test all the edge cases in §4.4.

### Phase 5 — AI (3–4 days)
- Implement Medium AI per §5.
- Wire AI turns into the store with paced `setTimeout` dispatches.
- Play many games against it. Tune heuristics.
- Add unit tests for AI primitive functions (`findCandidateSets`, `score`).

### Phase 6 — Polish (1–2 days)
- Animations (card slide / flip).
- Sound? (Skip for v1; track in `notes.txt`.)
- Empty states, error states, accessibility (focus rings, aria-labels on cards, keyboard navigation through hand).
- README with build/deploy steps.

### Phase 7 — Deploy (½ day)
- `npm run build` → `dist/` directory.
- Copy `dist/` to VPS; serve with Nginx (`try_files $uri /index.html;` for SPA routing — actually we have no routes, so a plain static block is enough).
- Verify on real mobile device.

**Total estimate: ~12–14 working days for a single developer.**

---

## 8. Testing Strategy

### Engine
- Vitest unit tests for every public function in `engine/`.
- Property-based tests are nice-to-have for `isValidSet` (random valid groups/runs should validate; random shuffles of a valid set should still validate).
- Replay tests: a full scripted game (DRAW, PLAY_SET, DISCARD, …) should produce a known final state from a known seed.

### AI
- Integration tests where the AI plays a deterministic seed against a "null player" that always draws and discards the first card. The AI should win within N turns. Failing this test means a heuristic regression.

### UI
- Component-level smoke tests with `@testing-library/react` for each major component (does it render given `GameState`?).
- Manual mobile device testing — at minimum on iOS Safari and Android Chrome — before each release. dnd-kit is good but always verify.

### Manual Test Checklist (run before each merge to main)
- Win the game in a simple 2-player session.
- Lose the game (let the AI win) in a 4-player session.
- Take the discard pile when it's large.
- Trigger draw-pile replenishment.
- Open with a 4-card group; open with a 4-card run.
- Use an Ace as a wild in a group; use an Ace in the middle of a run; use an Ace at the K end.
- Replace an Ace in a table set with the real card from hand.
- Rearrange the table to merge two runs.
- Try to rearrange so another player loses their opening set — confirm should be disabled.

---

## 9. Deployment

### Build
```
npm install
npm run build
```
Outputs to `dist/`.

### Local preview
```
npm run preview
```

### VPS (Nginx)
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
Add HTTPS with Let's Encrypt before pointing real users at it.

---

## 10. Open Questions / Decisions Deferred

These are intentionally deferred. Track in `notes.txt`.

- **AI difficulty levels** beyond Medium — Easy and Hard.
- **Multiplayer over network** — would require a backend; out of scope for v1.
- **Persistent stats** (games won, average turns) — would need `localStorage`; trivial to add later.
- **Sound** — skip for v1 to keep the surface clean.
- **Theme switching** (dark mode) — Tailwind makes this easy; defer.
- **Onboarding tutorial** — for v1, the Rules modal is enough.
- **Spectator / replay mode** — the deterministic engine + seed makes this possible; defer.
- **Score across rounds** (e.g. tracking who-wins-best-of-5) — defer.

---

## 11. Decisions Already Made (from clarification round)

For the record, so there's no ambiguity in implementation:

1. **Players:** 1 human + selectable 1, 2, or 3 AI opponents.
2. **Difficulty:** single Medium AI; difficulty selector hooks designed in but unused for v1.
3. **Stack:** TypeScript + Vite + React 18 + Zustand + dnd-kit + Tailwind; Vitest for tests.
4. **Branding:** clean, modern, "Silicon Valley" tech aesthetic; lowercase `beanie` wordmark; single indigo accent.
5. **Drag & drop with click-to-select fallback** — both interaction patterns are first-class for mobile parity.
6. **Aces:** explicit role under the hood (`AceRole`), inferred where unambiguous, picker modal where ambiguous.
7. **Aces never represent 1 or themselves** — runs span 2–K, max top is K.
8. **Multiple Aces per set** allowed.
9. **Mobile responsive is required** — desktop down to 360 px wide.
10. **Static deploy** to VPS.
