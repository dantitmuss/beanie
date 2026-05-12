# Beanie — V4 Plan

V4 ships the **PyTorch RL scaffolding** deferred from V3 ([plan-v3.md](plan-v3.md)). V3 is assumed merged and stable — the `AIWeights` schema and self-play tuning scripts already exist by the time this begins.

The goal is to leave a clean, well-documented drop-in point so that a future Python implementer (or future-you) can train RL-optimised weights and slot them into the game with no runtime code changes.

---

## 1. Scope

In scope for V4:

1. **`training/` directory** — scaffolding docs only, no Python code.
2. **`training/README.md`** — end-to-end guide: how to train, validate, and replace `src/ai/weights/*.json`.
3. **`training/schema.md`** — plain-English mirror of `src/ai/weights/schema.ts` for the Python implementer.
4. **`training/engine_spec.md`** — canonical rules summary sufficient to re-implement the engine in Python without reading the TypeScript.

Out of scope for V4:

- The actual PyTorch training run.
- A Python re-implementation of the engine (though `engine_spec.md` makes it straightforward).
- Changes to any runtime app code.

---

## 2. Content Specifications

### 2.1 `training/README.md`

Covers:

- The `AIWeights` schema (cross-references `src/ai/weights/schema.ts` as single source of truth).
- The expected output: `weights/{easy,medium,hard}.json` matching the schema, dropped into `src/ai/weights/`.
- Two viable training paths and their trade-offs:
  1. **Reimplement the engine in Python** — recommended. The TS engine is ~500 LoC of pure logic across `deck.ts`, `sets.ts`, `actions.ts`, `rearrange.ts`. A 1:1 port unlocks fast vectorised training.
  2. **Bridge to JS via subprocess / Node** — reuses the canonical engine but has per-step process-call overhead. Slow for RL; only worth it for prototyping.
- Suggested algorithm sketch (PPO or similar; self-play with the three difficulties as opposing populations).
- Validation step before committing new weights: import the candidate JSON via the runtime schema validator (`src/ai/weights/schema.ts`), then run `npm run ai:simulate` to verify the win-rate matrix still holds.

### 2.2 `training/schema.md`

A plain-English description of every field in `AIWeights` — what it controls, its units/range, and how the heuristic policies use it. Kept in sync with `schema.ts` by convention (not auto-generated).

### 2.3 `training/engine_spec.md`

A rules + state-machine summary complete enough to re-implement the engine from scratch:

- State representation (players, hand, table, draw pile, discard pile, phase, current player).
- Phase transitions: `awaitingDraw` → `inTurn` → `awaitingDraw` (or `gameOver`).
- Legal actions per phase and their effects.
- Win condition: discard your last card after opening.
- Set validity rules (groups, runs, Ace wild, no looping runs, min sizes).
- Rearrange constraints (every player who had opened must still have an opening set).

---

## 3. File Structure

```
training/
├── README.md          (training guide)
├── schema.md          (AIWeights field reference)
└── engine_spec.md     (rules + state machine for Python re-impl)
```

No `.gitkeep` needed — the three files above are the deliverable.

---

## 4. Build Phases

### Phase 1 — engine_spec.md (½ day)
Write the engine spec first, since it's the foundation everything else references. Validate it by mentally re-deriving a short game from scratch using only the spec.

### Phase 2 — schema.md (¼ day)
Document every `AIWeights` field. Cross-check against `src/ai/weights/schema.ts` and the three `*.json` files.

### Phase 3 — README.md (¼ day)
Write the end-to-end training guide. Link to the two other docs. Include the validation step.

**Total estimate: ~1 working day.**

---

## 5. Decisions Already Made

1. **Docs only:** V4 ships no Python code and no runtime changes.
2. **Recommended training path:** Python engine re-implementation over JS bridge, for training speed.
3. **Schema source of truth:** `src/ai/weights/schema.ts` — `schema.md` is a human-readable mirror, not a replacement.

---

## 6. Open Questions / Decisions Deferred

- **Actual PyTorch training run** — produces final `weights/*.json`; deferred to a future release once the scaffolding is in place and someone has time to run it.
- **Per-seat AI personalities** — different weights per AI seat in a single game. Store API from V3 supports it internally; UI and training implications deferred.
