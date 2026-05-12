# Beanie — V2 Plan

V1 is shipped: 62 tests, clean static bundle, single-difficulty Medium AI, click-to-select interactions only. This document is the V2 implementation brief. Read end-to-end before coding.

V2 keeps the same stack, the same engine, and the same aesthetic. It is a **focused increment** — four user-visible changes that improve the existing single-difficulty experience. AI difficulty levels are deferred to V3 ([plan-v3.md](plan-v3.md)) so V2 stays small and shippable.

---

## 1. Scope

In scope for V2:

1. **Bigger card icons** — current `w-14 h-20` cards with a `text-xl` centre suit aren't legible enough. Scale up.
2. **Hand drag-and-drop reorder** — humans can rearrange their own hand by dragging. (Drag for *playing* cards stays out of scope; tap-to-select continues to handle that.)
3. **Discard-pile viewer modal** — a button near the discard pile opens a modal showing all cards, top-of-pile first.
4. **Rearrange "new set" bug fix** — creating a new set from selected hand cards in rearrange mode silently misplaces the 2nd+ card.

Out of scope for V2:

- AI difficulty (Easy / Hard) and the title-screen difficulty selector → **see [plan-v3.md](plan-v3.md)**.
- Full drag-and-drop for playing/discarding cards.
- Multiplayer, persistence/resume, sound, dark mode, tutorial.

---

## 2. Item-by-Item Specification

### 2.1 Bigger Icons

**Problem:** suit glyph is `text-xl` (~20 px) on a `w-14 h-20` card. On a 4-player game with 12+ hand cards, suits become hard to scan, especially on mobile.

**Approach:** scale the whole card up by ~30 %, scale the suit glyph up further so it dominates the card visually. Keep the corner ranks readable but secondary.

| | V1 default | V1 compact | V2 default | V2 compact |
|---|---|---|---|---|
| Width | `w-14` (56) | `w-10` (40) | `w-[72px]` | `w-[52px]` |
| Height | `h-20` (80) | `h-14` (56) | `h-[104px]` | `h-[76px]` |
| Centre suit | `text-xl` (20) | `text-sm` (14) | `text-[36px]` | `text-[24px]` |
| Corner rank | `text-sm` (14) | `text-[11px]` | `text-base` (16) | `text-xs` (12) |
| AceRole subscript | `text-[8px]` | (same) | `text-[10px]` | `text-[9px]` |
| Padding | `p-1` | `p-[3px]` | `p-1.5` | `p-1` |

Implementation lives in [src/ui/CardView.tsx](src/ui/CardView.tsx) — single file change. The compact variant is used by sets in [src/ui/TableSet.tsx](src/ui/TableSet.tsx), [src/ui/PlayerArea.tsx](src/ui/PlayerArea.tsx), [src/ui/OpponentArea.tsx](src/ui/OpponentArea.tsx), and [src/ui/RearrangeBoard.tsx](src/ui/RearrangeBoard.tsx).

**Mobile check:** at 360 px wide a 9-card hand at `w-[72px] gap-2` is 712 px — overflow scroll already handles that ([src/ui/Hand.tsx:14](src/ui/Hand.tsx#L14)). Verify on real device. Set rows in [src/ui/PlayerArea.tsx](src/ui/PlayerArea.tsx) may need tighter `gap-1` to keep multi-set rows on screen.

**Acceptance:** suit glyph readable at 360 px screen width without zoom; passes existing component smoke tests; no regressions in selected/dragging visual states.

---

### 2.2 Hand Drag-and-Drop Reorder

**Goal:** the human can drag any card in their hand to any position. Card *identity* doesn't change — this is purely visual order so the player can group their own thinking. Engine state is untouched.

**Library:** `@dnd-kit/core` + `@dnd-kit/sortable`. The original plan called for these; they were never installed. Add as runtime deps. Keep `@dnd-kit/utilities` for transform helpers.

**Where order lives:** the engine's `Player.hand: Card[]` is the source of truth for *which* cards the human holds. V1 happens to render hand in the order the engine returns. V2 needs a separate **display order** that:

- Is owned by the UI layer, not the engine (engine stays pure & deterministic).
- Resets on game start.
- Survives any engine action that adds cards (DRAW / TAKE_DISCARD): new cards append to the *end* of the display order.
- Drops cards from the order when they leave the hand (PLAY_SET / DISCARD).

**State location:** add `handOrder: string[]` (card IDs) to a small new UI store, or to the existing [src/store/gameStore.ts](src/store/gameStore.ts) as a sibling slice. Keep it derived/synced — a `useEffect` after every state change reconciles `handOrder` against `state.players[0].hand`:

```ts
function reconcile(handOrder: string[], hand: Card[]): string[] {
  const handIds = new Set(hand.map((c) => c.id));
  const kept = handOrder.filter((id) => handIds.has(id));
  const newOnes = hand.map((c) => c.id).filter((id) => !kept.includes(id));
  return [...kept, ...newOnes];
}
```

**Component changes:**

- [src/ui/Hand.tsx](src/ui/Hand.tsx) — wrap in `<DndContext>` + `<SortableContext strategy={horizontalListSortingStrategy}>`; replace each child with a `SortableCardView` that registers via `useSortable({ id })`. Keep tap-to-select behaviour intact (dnd-kit allows clicks under the activation distance).
- Activation: `PointerSensor` with `{ activationConstraint: { distance: 5 } }` on desktop and `TouchSensor` with `{ activationConstraint: { delay: 200, tolerance: 5 } }` on mobile. The 200 ms long-press lets a tap select-without-drag.
- `KeyboardSensor` from `@dnd-kit/sortable` for accessibility — arrow keys move a focused card.

**Edge cases:**

- Reordering during the AI's turn: allowed; it's local visual state.
- Reordering during rearrange mode: disabled. The rearrange UI uses a working hand from a different store ([src/store/rearrangeStore.ts](src/store/rearrangeStore.ts)) and that hand has its own order semantics.
- Cards rendered by [src/ui/RearrangeBoard.tsx](src/ui/RearrangeBoard.tsx) under "working hand" do **not** get drag-to-reorder in V2 — out of scope.

**Acceptance:** drag-reorder works on desktop (mouse) and mobile (long-press); tap-to-select still works; new draws append to the visual end of the hand; visual order persists across engine updates within a game.

---

### 2.3 Discard-Pile Viewer Modal

**Trigger:** small icon button (e.g. an `i` info glyph or "view" eye) below or beside the discard pile in [src/ui/DiscardPile.tsx](src/ui/DiscardPile.tsx). Available at all times — including during AI turns and during rearrange mode — because the discard pile is fully public information (any player can take the entire pile, which reveals it).

**Modal behaviour:** render a new `DiscardPileModal.tsx` modelled on [src/ui/RulesModal.tsx](src/ui/RulesModal.tsx) and [src/ui/EndGameModal.tsx](src/ui/EndGameModal.tsx).

- Title: "Discard pile (N cards)".
- Body: scrollable vertical list of cards, top-of-pile first (i.e. most recently discarded card at the top, in normal `CardView` size — these are larger than the in-hand size for legibility). Each row shows a card; we don't currently track per-card discard age, so skip "N turns ago" timing for V2.
- Empty state: "No cards in the discard pile yet."
- Close: X button + Esc key + click-outside.

**No engine change needed** — `state.discardPile: Card[]` already exists. Order is preserved by [src/engine/actions.ts](src/engine/actions.ts) (DISCARD pushes to the end; the "top" of the pile is the last element).

**Acceptance:** opens/closes correctly; reflects the live pile (re-renders if the AI discards while the modal is open); doesn't block the rest of the UI behind a focus trap that would prevent forfeiting / restarting.

---

### 2.4 Rearrange "New Set" Bug

**Symptom:** in rearrange mode, selecting multiple hand cards and tapping the "+" new-set zone places only the first card into a new set; the rest are silently appended to the previous last set on the table — or, if no sets exist, are silently dropped.

**Root cause** — [src/ui/RearrangeBoard.tsx:108-115](src/ui/RearrangeBoard.tsx#L108-L115):

```ts
moveCardToSet(firstCard.id, 'new', 'hand');
const newSet = workingTable[workingTable.length - 1];   // <-- stale closure value
if (!newSet) return;
for (let i = 1; i < cards.length; i++) {
  moveCardToSet(cards[i]!.id, newSet.id, 'hand');
}
```

`workingTable` is the closed-over render value, captured *before* `moveCardToSet` updated the store. So `newSet` is the previous last set (or `undefined` when there are no sets), not the freshly-created one.

**Fix:** add a single rearrange-store action that creates a set from N cards atomically. In [src/store/rearrangeStore.ts](src/store/rearrangeStore.ts):

```ts
createSetFromHand(cards: CardInSet[]): string  // returns new set id
```

It mutates `workingTable` and `workingHand` in one Zustand `set()`, so there's no stale-state window. The caller in `RearrangeBoard.tsx` becomes:

```ts
const id = createSetFromHand(cards.map((c) => ({ card: c })));
```

Apply the same atomic pattern to the AcePicker `'new'` branch ([src/ui/RearrangeBoard.tsx:125-142](src/ui/RearrangeBoard.tsx#L125-L142)) which has a sibling smell — it `setState`s the new set and then loops `moveCardToSet` against the still-stale `workingTable`. The two callsites should use the same `createSetFromHand` helper, with an optional `aceRole` argument applied to ace cards.

**Test:** add a Vitest case in `src/store/__tests__/rearrangeStore.test.ts` (new file) covering: (a) empty workingTable + 3 hand cards → new set with all 3, hand drained; (b) non-empty workingTable + 3 hand cards → new set appended, existing sets untouched.

**Acceptance:** creating a new set from 3+ hand cards in rearrange mode places exactly those cards into one new set; works whether or not other sets already exist.

---

## 3. Testing Strategy

### 3.1 Engine
No engine changes in V2. Existing 62 tests continue to pass.

### 3.2 Store
- New `src/store/__tests__/rearrangeStore.test.ts` covering `createSetFromHand` (empty table + non-empty table cases).
- Optional regression test that drives the `RearrangeBoard.handleAddToSet('new')` flow end-to-end with React Testing Library — recommended given how easy the bug was to miss.

### 3.3 UI
- Manual: bigger icons readable at 360 px / 768 px / 1024 px.
- Manual: drag-reorder works on a real iPhone and Android device (long-press 200 ms; doesn't fight tap-to-select).
- Manual: discard-pile modal shows correct order, scrolls when pile is large, closes on Esc.

---

## 4. Build Phases

Each phase is a runnable, demoable state. Don't skip ahead.

### Phase 0 — Setup (¼ day)
- Branch `v2` off `main`.
- `npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.
- No behaviour change.

### Phase 1 — Bigger Icons (½ day)
- Single-file change in [src/ui/CardView.tsx](src/ui/CardView.tsx) per §2.1.
- Visual regression check across all screens.

### Phase 2 — Rearrange New-Set Bug Fix (½ day)
- `createSetFromHand` action in `rearrangeStore.ts`.
- Refactor [src/ui/RearrangeBoard.tsx:66-159](src/ui/RearrangeBoard.tsx#L66-L159) to use it (both the plain branch and the AcePicker branch).
- Add the store-level test.

### Phase 3 — Hand Drag-Reorder (1 day)
- Add `handOrder` slice + reconcile effect in `gameStore.ts`.
- Wrap [src/ui/Hand.tsx](src/ui/Hand.tsx) in dnd-kit; SortableCardView wrapper.
- Mobile sensor tuning (long-press 200 ms).
- Verify tap-to-select untouched.

### Phase 4 — Discard Pile Viewer (½ day)
- New `src/ui/DiscardPileModal.tsx`.
- Trigger button in `DiscardPile.tsx`.
- Modeled on `RulesModal.tsx` close/escape pattern.

### Phase 5 — Polish + Deploy (¼ day)
- Manual mobile pass.
- Update `README.md` with V2 features.
- `npm run build` → deploy.

**Total estimate: ~3 working days.**

---

## 5. Decisions Already Made (V2 clarification round)

For the record:

1. **Drag scope:** hand reorder only. No drag for playing cards in V2.
2. **Discard viewer:** modal, top-of-pile first, accessible at all times.
3. **AI difficulty:** explicitly deferred to V3 ([plan-v3.md](plan-v3.md)) so V2 stays small.

---

## 6. Open Questions / Decisions Deferred

Track in `notes.txt`.

- **Hand-order persistence across sessions** — V2 resets order each game. localStorage carryover is trivial; defer.
- **Drag-to-play / drag-to-discard** — full dnd-kit overhaul of play interactions; out of V2 scope.
- **Pile-card timing in viewer** — "discarded N turns ago" requires tracking a turn counter per discard; skip until needed.
- **Tutorial / onboarding for V2 features** — drag-reorder is discoverable; new players will figure it out.

---

## 7. File Change Summary

**New:**
- `src/store/__tests__/rearrangeStore.test.ts`
- `src/ui/DiscardPileModal.tsx`

**Modified:**
- `src/ui/CardView.tsx` (size scaling)
- `src/ui/Hand.tsx` (dnd-kit wrapping)
- `src/ui/DiscardPile.tsx` (viewer button)
- `src/ui/RearrangeBoard.tsx` (use atomic createSetFromHand)
- `src/store/gameStore.ts` (handOrder slice)
- `src/store/rearrangeStore.ts` (createSetFromHand action)
- `package.json` (dnd-kit deps)
- `README.md` (V2 feature list)

**Unchanged (engine stays pure):**
- Everything under `src/engine/` and `src/ai/`.
