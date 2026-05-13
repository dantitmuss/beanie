/**
 * Simulate N games between pairs of AI policies and print a win-rate matrix.
 * Usage: npm run ai:simulate [-- --games=200 --seeds=100]
 */
import { createInitialState } from '../src/engine/state.js';
import { applyAction } from '../src/engine/actions.js';
import { makePolicy } from '../src/ai/policy.js';
import { validateWeights } from '../src/ai/weights/schema.js';
import type { AIPolicy, Difficulty } from '../src/ai/types.js';
import easyData from '../src/ai/weights/easy.json' with { type: 'json' };
import mediumData from '../src/ai/weights/medium.json' with { type: 'json' };
import hardData from '../src/ai/weights/hard.json' with { type: 'json' };
import type { GameState } from '../src/engine/types.js';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const policies: Record<Difficulty, AIPolicy> = {
  easy:   makePolicy('easy',   validateWeights(easyData,   'easy')),
  medium: makePolicy('medium', validateWeights(mediumData, 'medium')),
  hard:   makePolicy('hard',   validateWeights(hardData,   'hard')),
};

function runGame(
  pol0: AIPolicy,
  pol1: AIPolicy,
  seed: number,
): 0 | 1 | null {
  let state: GameState = createInitialState(['P0', 'P1'], seed);
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, isAI: true })),
  };

  const MAX_TURNS = 800;
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

  if (state.phase !== 'gameOver') return null; // draw / timeout

  const winner = state.players.find((p) => p.hand.length === 0);
  if (!winner) return null;
  return winner.id === state.players[0]!.id ? 0 : 1;
}

function simulate(
  pol0: AIPolicy,
  pol1: AIPolicy,
  numGames: number,
): { winRate0: number; completionRate: number } {
  let wins0 = 0;
  let completed = 0;

  for (let seed = 0; seed < numGames; seed++) {
    const result = runGame(pol0, pol1, seed);
    if (result !== null) {
      completed++;
      if (result === 0) wins0++;
    }
  }

  // Win rate among completed games (excludes timeouts caused by Easy's slow play style)
  const winRate0 = completed > 0 ? wins0 / completed : 0.5;
  return { winRate0, completionRate: completed / numGames };
}

function main() {
  const args = process.argv.slice(2);
  const numGames = parseInt(
    args.find((a) => a.startsWith('--games='))?.slice('--games='.length) ?? '100',
    10,
  );

  console.log(`\nSimulating ${numGames} games per matchup...\n`);

  // Build win-rate matrix and cache results for acceptance check
  const matrix: Record<string, Record<string, string>> = {};
  const results: Record<string, Record<string, { winRate0: number; completionRate: number }>> = {};

  for (const d0 of DIFFICULTIES) {
    matrix[d0] = {};
    results[d0] = {};
    for (const d1 of DIFFICULTIES) {
      if (d0 === d1) {
        matrix[d0]![d1] = ' 50%';
        results[d0]![d1] = { winRate0: 0.5, completionRate: 1 };
        continue;
      }
      const result = simulate(policies[d0], policies[d1], numGames);
      results[d0]![d1] = result;
      const { winRate0, completionRate } = result;
      const pct = `${Math.round(winRate0 * 100)}%`;
      const note = completionRate < 0.8 ? `*${Math.round(completionRate * 100)}%` : '';
      matrix[d0]![d1] = (pct + note).padStart(6);
    }
  }

  // Print matrix (win rates among completed games; *N% = completion rate when < 80%)
  console.log('Win rate among completed games (* = low completion rate):\n');
  const header = '        ' + DIFFICULTIES.map((d) => d.padEnd(8)).join(' ');
  console.log(header);
  for (const d0 of DIFFICULTIES) {
    const row = d0.padEnd(8) + DIFFICULTIES.map((d1) => matrix[d0]![d1]!.padEnd(8)).join(' ');
    console.log(row);
  }

  // Check acceptance criterion using cached matrix results (avoid re-running + PRNG state drift)
  console.log('\nAcceptance check (each tier must win ≥65% of completed games vs tier below):');
  const { winRate0: medVsEasy, completionRate: medComp } = results['medium']!['easy']!;
  const { winRate0: hardVsMed, completionRate: hardComp } = results['hard']!['medium']!;
  const medOk = medVsEasy >= 0.65;
  const hardOk = hardVsMed >= 0.65;
  console.log(`  Medium vs Easy:  ${Math.round(medVsEasy * 100)}% (${Math.round(medComp * 100)}% games complete) ${medOk ? '✓' : '✗ (need ≥65%)'}`);
  console.log(`  Hard vs Medium:  ${Math.round(hardVsMed * 100)}% (${Math.round(hardComp * 100)}% games complete) ${hardOk ? '✓' : '✗ (need ≥65%)'}`);

  if (medOk && hardOk) {
    console.log('\n✓ Weights pass acceptance criterion.\n');
  } else {
    console.log('\n✗ Weights do not yet meet acceptance criterion. Run npm run ai:tune.\n');
    process.exit(1);
  }
}

main();
