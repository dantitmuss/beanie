/**
 * Hill-climb weight tuning for a single difficulty tier.
 * Usage: npm run ai:tune [-- --difficulty=hard --iters=200 --games=50]
 *
 * Objective: maximise win rate of <difficulty> vs its lower neighbour.
 * Writes the best found weights to src/ai/weights/<difficulty>.json.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialState } from '../src/engine/state.js';
import { applyAction } from '../src/engine/actions.js';
import { makePolicy } from '../src/ai/policy.js';
import { validateWeights } from '../src/ai/weights/schema.js';
import type { AIPolicy, AIWeights, Difficulty } from '../src/ai/types.js';
import easyData from '../src/ai/weights/easy.json' with { type: 'json' };
import mediumData from '../src/ai/weights/medium.json' with { type: 'json' };
import hardData from '../src/ai/weights/hard.json' with { type: 'json' };
import type { GameState } from '../src/engine/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function runGame(pol0: AIPolicy, pol1: AIPolicy, seed: number): 0 | 1 | null {
  let state: GameState = createInitialState(['P0', 'P1'], seed);
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, isAI: true })),
  };

  const MAX_TURNS = 300;
  let turns = 0;

  while (state.phase !== 'gameOver' && turns < MAX_TURNS) {
    const idx = state.currentPlayerIdx;
    const pol = idx === 0 ? pol0 : pol1;
    const actions = pol.computeTurn(state, state.players[idx]!.id);

    for (const action of actions) {
      try {
        state = applyAction(state, action);
        if (state.phase === 'gameOver') break;
      } catch {
        break;
      }
    }
    turns++;
  }

  if (state.phase !== 'gameOver') return null;
  const winner = state.players.find((p) => p.hand.length === 0);
  if (!winner) return null;
  return winner.id === state.players[0]!.id ? 0 : 1;
}

function winRate(pol0: AIPolicy, pol1: AIPolicy, numGames: number): number {
  let wins = 0;
  let completed = 0;
  for (let seed = 0; seed < numGames; seed++) {
    const r = runGame(pol0, pol1, seed);
    if (r !== null) {
      completed++;
      if (r === 0) wins++;
    }
  }
  return completed > 0 ? wins / completed : 0.5;
}

// Numeric keys that can be perturbed
const NUMERIC_KEYS: Array<keyof AIWeights> = [
  'takeDiscardCompletesSetBonus',
  'takeDiscardOpeningBonus',
  'takeDiscardPileSizeCap',
  'nearSetBonus',
  'sameRankBonus',
  'sameSuitNearRankBonus',
  'aceBonus',
  'staleDecay',
];

function perturb(weights: AIWeights, magnitude: number): AIWeights {
  const copy = { ...weights };
  // Randomly select 1–3 numeric fields to perturb
  const keys = [...NUMERIC_KEYS].sort(() => Math.random() - 0.5).slice(0, 3);
  for (const k of keys) {
    const cur = copy[k] as number;
    const delta = (Math.random() * 2 - 1) * magnitude * Math.abs(cur + 0.01);
    (copy as Record<string, unknown>)[k] = Math.max(0, cur + delta);
  }
  return copy;
}

function loadBaseWeights(difficulty: Difficulty): AIWeights {
  const raw = difficulty === 'easy' ? easyData : difficulty === 'medium' ? mediumData : hardData;
  return validateWeights(raw, difficulty);
}

function lowerNeighbour(difficulty: Difficulty): Difficulty {
  if (difficulty === 'hard') return 'medium';
  if (difficulty === 'medium') return 'easy';
  throw new Error('easy has no lower neighbour to tune against');
}

async function main() {
  const args = process.argv.slice(2);

  const difficulty = (
    args.find((a) => a.startsWith('--difficulty='))?.slice('--difficulty='.length) ?? 'hard'
  ) as Difficulty;

  const iters = parseInt(
    args.find((a) => a.startsWith('--iters='))?.slice('--iters='.length) ?? '200',
    10,
  );

  const numGames = parseInt(
    args.find((a) => a.startsWith('--games='))?.slice('--games='.length) ?? '50',
    10,
  );

  if (difficulty === 'easy') {
    console.error('Cannot tune easy (no lower neighbour). Use --difficulty=medium or --difficulty=hard.');
    process.exit(1);
  }

  const opponent = lowerNeighbour(difficulty);
  console.log(`\nTuning ${difficulty} vs ${opponent} — ${iters} iterations, ${numGames} games each\n`);

  let bestWeights = loadBaseWeights(difficulty);
  const opponentWeights = loadBaseWeights(opponent);
  const opponentPolicy = makePolicy(opponent, opponentWeights);

  let bestScore = winRate(makePolicy(difficulty, bestWeights), opponentPolicy, numGames);
  console.log(`Baseline ${difficulty} win rate vs ${opponent}: ${Math.round(bestScore * 100)}%`);

  const MAGNITUDE_START = 0.3;
  const MAGNITUDE_END = 0.05;

  for (let i = 0; i < iters; i++) {
    const progress = i / iters;
    const magnitude = MAGNITUDE_START * (1 - progress) + MAGNITUDE_END * progress;
    const candidate = perturb(bestWeights, magnitude);

    try {
      validateWeights(candidate, 'candidate');
    } catch {
      continue;
    }

    const score = winRate(makePolicy(difficulty, candidate), opponentPolicy, numGames);

    if (score > bestScore) {
      bestScore = score;
      bestWeights = candidate;
      console.log(`  iter ${i + 1}: improved to ${Math.round(score * 100)}% win rate`);
    }

    if (i % 50 === 49) {
      console.log(`  iter ${i + 1}: best so far ${Math.round(bestScore * 100)}%`);
    }
  }

  console.log(`\nFinal ${difficulty} win rate vs ${opponent}: ${Math.round(bestScore * 100)}%`);

  const outPath = resolve(__dirname, `../src/ai/weights/${difficulty}.json`);
  const rounded: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bestWeights)) {
    rounded[k] = typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  }
  writeFileSync(outPath, JSON.stringify(rounded, null, 2) + '\n');
  console.log(`Wrote tuned weights to ${outPath}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
