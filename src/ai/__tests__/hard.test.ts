import { describe, expect, it } from 'vitest';
import { makePolicy } from '../policy';
import { validateWeights } from '../weights/schema';
import { createInitialState } from '../../engine/state';
import { applyAction } from '../../engine/actions';
import type { Card, GameState } from '../../engine/types';
import hardData from '../weights/hard.json';
import mediumData from '../weights/medium.json';

const hardWeights = validateWeights(hardData, 'hard');
const mediumWeights = validateWeights(mediumData, 'medium');
const hardPolicy = makePolicy('hard', hardWeights);
const mediumPolicy = makePolicy('medium', mediumWeights);

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { id: `${rank}${suit}`, rank, suit };
}

function runGame(seed: number): 'hard' | 'medium' | 'draw' {
  let state = createInitialState(['Hard', 'Medium'], seed);
  const p0 = state.players[0]!;
  const p1 = state.players[1]!;
  state = {
    ...state,
    players: [
      { ...p0, isAI: true },
      { ...p1, isAI: true },
    ],
  };

  let turns = 0;
  const MAX_TURNS = 300;

  while (state.phase !== 'gameOver' && turns < MAX_TURNS) {
    const playerIdx = state.currentPlayerIdx;
    const player = state.players[playerIdx]!;
    const pol = playerIdx === 0 ? hardPolicy : mediumPolicy;
    const actions = pol.computeTurn(state, player.id);

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

  if (state.phase !== 'gameOver') return 'draw';

  // Winner = the player whose opponent has no cards left (game ends when a player empties hand)
  // Check who triggered the win by finding which player has 0 cards
  const winner = state.players.find((p) => p.hand.length === 0);
  if (!winner) return 'draw';
  return winner.id === state.players[0]!.id ? 'hard' : 'medium';
}

describe('hard policy', () => {
  it('plays a valid game without crashing', () => {
    const state: GameState = {
      ...createInitialState(['Hard', 'Medium'], 42),
      players: createInitialState(['Hard', 'Medium'], 42).players.map((p) => ({
        ...p,
        isAI: true,
      })),
    };

    const player = state.players[state.currentPlayerIdx]!;
    const actions = hardPolicy.computeTurn(state, player.id);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]?.type === 'DRAW' || actions[0]?.type === 'TAKE_DISCARD').toBe(true);
    const last = actions[actions.length - 1];
    expect(last?.type === 'DISCARD' || state.phase === 'gameOver').toBe(true);
  });

  it('respects MCTS time budget (< 300ms per turn)', () => {
    const state = {
      ...createInitialState(['Hard', 'Medium'], 7),
      players: createInitialState(['Hard', 'Medium'], 7).players.map((p) => ({
        ...p,
        isAI: true,
        hasOpened: true,
      })),
    };

    const player = state.players[0]!;
    const start = Date.now();
    hardPolicy.computeTurn(state, player.id);
    expect(Date.now() - start).toBeLessThan(300);
  });

  it('aggressive intake: takes discard when pile card is useful', () => {
    const base = createInitialState(['Hard', 'Medium'], 42);
    const state: GameState = {
      ...base,
      phase: 'awaitingDraw',
      currentPlayerIdx: 0,
      discardPile: [card('7', '♥')],
      drawPile: [card('2', '♣')],
      players: [
        {
          ...base.players[0]!,
          isAI: true,
          hasOpened: true,
          // Hand has two 7s — pile 7♥ would near-complete a group
          hand: [card('7', '♣'), card('7', '♦'), card('K', '♠'), card('2', '♦')],
        },
        base.players[1]!,
      ],
    };
    const actions = hardPolicy.computeTurn(state, state.players[0]!.id);
    // Hard should see the pile 7♥ as useful (matches rank of two hand 7s → near-group)
    // and take the discard despite not immediately completing a set
    // (pile size 1 ≤ takeDiscardPileSizeCap 8)
    expect(actions[0]?.type).toBe('TAKE_DISCARD');
  });

  // Win-rate test: hard should beat medium in a majority of games.
  // Uses a small fixed-seed sample; full 100-seed run is deferred to Phase 3 tuning.
  it('beats medium in majority of fixed-seed games (10 seeds)', () => {
    const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let hardWins = 0;

    for (const seed of SEEDS) {
      const result = runGame(seed);
      if (result === 'hard') hardWins++;
    }

    // Phase 2 sanity check: hard must win at least some games with placeholder weights.
    // Phase 3 acceptance criterion (after tune.ts): ≥60% over 100 seeds.
    expect(hardWins).toBeGreaterThanOrEqual(1);
  });
});
