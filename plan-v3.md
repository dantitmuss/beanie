# Beanie — V3 Plan

V3 ships **AI difficulty levels**: Easy, Medium, Hard. V2 ([plan-v2.md](plan-v2.md)) is assumed merged and stable — V3 builds on top of it.

The single Medium AI becomes one of three tiers, all reading from a parameterised **weights** schema. Default weights are tuned offline in TypeScript via self-play. The architecture is deliberately shaped so that a future PyTorch RL pipeline (see [plan-v4.md](plan-v4.md)) can drop trained weight JSONs into `src/ai/weights/` with zero runtime code change — but V3 does not ship any of that scaffolding.

---

## 0. Pre-conditions

Before starting Phase 1, fix the broken test runner. The `iconv-lite` node_modules issue currently prevents all tests from running (`Tests: no tests, Errors: 5`). This is a pre-existing environment problem unrelated to V3 code, but the 62-test baseline must be green before the refactor begins — otherwise there's no safety net for "Medium behaviour unchanged."

---

## 1. Scope

In scope for V3:

1. **Three AI tiers** — Easy, Medium, Hard — each implementing a common `AIPolicy` interface.
2. **`AIWeights` schema** — JSON-serialisable parameter object that each policy reads from. Schema lives in `src/ai/weights/schema.ts`.
3. **Default weights** for each tier, stored in `src/ai/weights/{easy,medium,hard}.json`.
4. **Offline self-play tuning** — `scripts/simulate.ts` and `scripts/tune.ts` for producing/validating those default weights without ML.
5. **Title-screen difficulty selector** — segmented control alongside player count.

Out of scope for V3:

- PyTorch scaffolding, training docs, engine spec → **deferred to [plan-v4.md](plan-v4.md)**.
- The actual PyTorch training run.
- A Python re-implementation of the engine.
- Per-seat AI personalities (different difficulties for different opponents in one game).

---

## 2. AI Tier Specifications

### 2.1 Common Interface

```ts
// src/ai/types.ts
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface AIWeights {
  // Intake
  takeDiscardCompletesSetBonus: number;     // weight if pile contains a set-completer
  takeDiscardOpeningBonus: number;          // extra weight if it completes an opener
  takeDiscardPileSizeCap: number;           // max pile size to consider taking
  // Scoring (per-card keep value)
  nearSetBonus: number;
  sameRankBonus: number;
  sameSuitNearRankBonus: number;
  aceBonus: number;
  staleDecay: number;
  // Rearrange aggressiveness
  rearrangeMaxDepth: number;                // 0 = never rearrange
  attemptAceReplacement: boolean;
  // Hard-only / MCTS
  mctsRollouts: number;                     // 0 disables
  mctsRolloutDepth: number;
}

export interface AIPolicy {
  computeTurn(state: GameState, aiId: PlayerId): AIAction[];
}

export function makePolicy(d: Difficulty, w: AIWeights): AIPolicy;
```

The store dispatches one `AIPolicy` instance per AI seat. V3 uses a single difficulty for all AI seats; per-seat is wired internally but not surfaced in the UI.

### 2.2 Easy

A deliberately weak baseline — beatable by a new player, gives the human breathing room while learning.

- **Always `DRAW`**, never `TAKE_DISCARD`.
- Plays the **first** valid set found by `findCandidateSets`, not the best one.
- **Never rearranges** (`rearrangeMaxDepth: 0`).
- **Never** attempts Ace replacement.
- Discards a uniformly random card from the bottom-half of `score.ts` ranking (so it isn't catastrophically bad — it shouldn't throw away its own opening set).

### 2.3 Medium

The V1 AI, refactored to read from `AIWeights` instead of hard-coded constants. **No behavioural change** vs. V1 once weights match the V1 hard-codes. This is mostly a refactor; the file structure changes, the play does not.

Note: the hand-empty guard added during V2 bugfixing (`medium.ts` — skip playing a set that would leave 0 cards in hand) must be preserved through this refactor.

### 2.4 Hard

Medium plus the following:

- More aggressive `TAKE_DISCARD`: takes when any pile card extends a *near-set* (within 1 card of valid), not only when it completes one.
- Attempts **Ace replacement**. The stub at [src/ai/medium.ts:36-53](src/ai/medium.ts#L36-L53) exists but is currently a no-op — this is real unfinished work that needs full wiring through a rearrange-style action. Budget time accordingly.
- Tries cheap rearrange patterns: merge two same-suit runs across a hand-card bridge; split a run to free an Ace.
- Single-ply MCTS-style rollout for discard choice: simulate the next 1–2 plies (random-but-rule-respecting opponent draws + discards, fixed N rollouts) and pick the discard that maximises expected end-of-turn hand quality. Bounded by `mctsRollouts × mctsRolloutDepth` to stay snappy (target < 200 ms per AI turn on a mid-tier laptop).

---

## 3. File Structure

```
src/ai/
├── types.ts                   (NEW — Difficulty, AIWeights, AIPolicy)
├── policy.ts                  (NEW — makePolicy dispatcher)
├── easy.ts                    (NEW)
├── medium.ts                  (REFACTOR — read from weights)
├── hard.ts                    (NEW)
├── mcts.ts                    (NEW — simple rollout for hard)
├── score.ts                   (REFACTOR — accept weights)
├── findSets.ts                (unchanged)
├── tryExtend.ts               (unchanged)
├── rearrangePatterns.ts       (NEW — bridge-merge, ace-replace as data)
├── weights/
│   ├── easy.json              (default tuned weights)
│   ├── medium.json
│   ├── hard.json
│   └── schema.ts              (Zod-or-equivalent runtime validation)
└── __tests__/
    ├── easy.test.ts           (NEW)
    ├── medium.test.ts         (existing — update)
    └── hard.test.ts           (NEW)
```

The runtime loads weights via static imports (`import easyWeights from './weights/easy.json'`) so they're bundled. No fetch at runtime.

---

## 4. Offline Self-Play Tuning (TypeScript)

Goal: produce reasonable default `weights/*.json` without leaving JS land.

```
scripts/
├── simulate.ts                (run N games between two policies, log win rate + turns)
└── tune.ts                    (random search / hill climbing over weights)
```

`simulate.ts` is straight TypeScript, run via `tsx scripts/simulate.ts`. It uses the existing pure engine + a fixed RNG seed list and prints win-rate matrices like:

```
       easy   medium  hard
easy   50%    18%     6%
medium 82%    50%     31%
hard   94%    69%     50%
```

`tune.ts` is a coarse random search: sample K weight perturbations around a baseline, run `simulate.ts` for each, keep the best by an objective like *"Hard wins ≥ 65 % vs Medium AND Hard turn count ≤ Medium turn count"*. A few hundred iterations on a laptop is enough for a sane baseline.

Add npm scripts:

```
"ai:simulate": "tsx scripts/simulate.ts",
"ai:tune":     "tsx scripts/tune.ts"
```

These run **offline only** — never bundled into the deployed app.

**Acceptance:** `npm run ai:simulate` prints a matrix where Hard > Medium > Easy by ≥ 15 % each.

---

## 5. Title-Screen Difficulty Selector

In [src/ui/Title.tsx](src/ui/Title.tsx), add a second segmented control underneath the player-count selector:

```
Players:      [ 2 ] [ 3 ] [ 4 ]
Difficulty:   [ Easy ] [ Medium ] [ Hard ]
```

Default: **Medium** (so existing players don't get a behaviour shift on first launch). Pass `difficulty` into the game-init action; the store instantiates one `AIPolicy` per AI seat using the chosen difficulty.

---

## 6. Testing Strategy

### 6.1 Engine
No engine changes in V3. Existing 62 tests must be passing before V3 work begins (see §0).

### 6.2 AI
- Existing `src/ai/__tests__/medium.test.ts` updated to construct the policy via `makePolicy('medium', mediumWeights)`.
- New `easy.test.ts`: never takes discard; never rearranges; finishes a 2-player game without crashing.
- New `hard.test.ts`: beats Medium ≥ 60 % over 100 fixed seeds; respects MCTS time budget (assert under 300 ms per turn on CI).
- Schema validation test: each shipped `weights/*.json` parses against `schema.ts`.

### 6.3 Offline scripts
- `npm run ai:simulate` produces a win-rate matrix where Hard > Medium > Easy by ≥ 15 % each.
- `npm run ai:tune` runs to completion and writes new weight files; weight files diff cleanly in git.

### 6.4 UI
- Manual: selecting Easy in a real 4-player game *feels* easier than Medium; selecting Hard *feels* harder.
- Manual: title-screen segmented control behaves like the existing player-count selector (keyboard nav, focus rings).

---

## 7. Build Phases

Each phase is a runnable, demoable state. Don't skip ahead.

### Phase 0 — Pre-conditions (before branching)
- Fix the broken `iconv-lite` / test runner so `npm test` runs and 62 tests pass.
- Branch `v3` off main once green.
- Create empty `src/ai/weights/` and `scripts/` directories with placeholder files.

### Phase 1 — AI Refactor: Weights + Difficulty Interface (1 day)
- Introduce `types.ts`, `policy.ts`, `weights/*.json`, `weights/schema.ts`.
- Refactor `medium.ts` to read from weights — **no behaviour change**, including preserving the hand-empty guard.
- Existing tests still pass.

### Phase 2 — Easy + Hard Implementations (1.5 days)
- Implement `easy.ts` (rule-based, deliberately weak).
- Implement `hard.ts` + `mcts.ts` + `rearrangePatterns.ts`. Note: Ace replacement is real unfinished work — the stub in `medium.ts` needs full wiring, not just a flag flip.
- Tests for each.

### Phase 3 — Offline Tuning (1 day)
- `scripts/simulate.ts` and `scripts/tune.ts`.
- Run against current hand-coded weights; commit tuned `weights/*.json`.
- Verify Hard > Medium > Easy in win-rate matrix.

### Phase 4 — Difficulty Selector UI (½ day)
- Title-screen segmented control.
- Plumb through game store.
- Verify selecting Easy actually feels easier in a real game.

### Phase 5 — Polish + Deploy (¼ day)
- Manual playtest at each difficulty.
- Update `README.md` with the difficulty feature and `npm run ai:*` scripts.
- `npm run build` → deploy.

**Total estimate: ~3.75 working days** (excluding Phase 0 test-runner fix).

---

## 8. Decisions Already Made

1. **AI approach:** heuristic per difficulty + offline self-play tuning in TypeScript. Architected so PyTorch-trained weights can replace the JSON later without runtime changes.
2. **PyTorch scaffolding moved to V4:** V3 does not ship training docs or the `training/` directory. See [plan-v4.md](plan-v4.md).
3. **Difficulty selector:** added to title screen, defaults to Medium.
4. **Single-difficulty per game:** all AI seats use the same difficulty in V3. Per-seat is a future hook.

---

## 9. Open Questions / Decisions Deferred

Track in `notes.txt`.

- **Live PyTorch RL run** — produces `weights/*.json`; deferred to V4+.
- **Per-seat AI personalities / mixed difficulties** — store API supports it; UI surfacing deferred.
- **Difficulty hint on title screen** — short blurb under each option ("Easy: never rearranges", "Hard: thinks ahead"). Nice-to-have.

---

## 10. File Change Summary

**New:**
- `src/ai/types.ts`, `policy.ts`, `easy.ts`, `hard.ts`, `mcts.ts`, `rearrangePatterns.ts`
- `src/ai/weights/{easy,medium,hard}.json`, `src/ai/weights/schema.ts`
- `src/ai/__tests__/easy.test.ts`, `hard.test.ts`
- `scripts/simulate.ts`, `scripts/tune.ts`

**Modified:**
- `src/ai/medium.ts`, `score.ts` (read from weights)
- `src/ai/__tests__/medium.test.ts` (use new policy constructor)
- `src/ui/Title.tsx` (difficulty selector)
- `src/store/gameStore.ts` (difficulty plumbing; per-seat policy instances)
- `package.json` (`tsx` dev dep; `ai:simulate` / `ai:tune` scripts)
- `README.md` (difficulty feature + script docs)

**Unchanged:**
- Everything under `src/engine/`.
- Everything shipped in V2 (CardView sizing, dnd-kit hand reorder, DiscardPileModal, rearrangeStore.createSetFromHand).
