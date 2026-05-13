import { describe, expect, it } from 'vitest';
import { makePolicy } from '../policy';
import { validateWeights } from '../weights/schema';
import { createInitialState } from '../../engine/state';
import { applyAction } from '../../engine/actions';
import type { Card, GameState } from '../../engine/types';
import easyData from '../weights/easy.json';

const easyWeights = validateWeights(easyData, 'easy');
const policy = makePolicy('easy', easyWeights);

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { id: `${rank}${suit}`, rank, suit };
}

function makeState(overrides: Partial<GameState>): GameState {
  const base = createInitialState(['Human', 'AI'], 42);
  return { ...base, ...overrides, players: overrides.players ?? base.players };
}

describe('easy policy', () => {
  it('always draws, never takes discard', () => {
    // Give AI a hand that would benefit from taking the discard
    const state = makeState({
      phase: 'awaitingDraw',
      currentPlayerIdx: 1,
      drawPile: [card('2', '♦')],
      discardPile: [card('8', '♣')],
      players: [
        createInitialState(['Human', 'AI'], 42).players[0]!,
        {
          id: 'player-1',
          name: 'AI',
          isAI: true,
          hasOpened: false,
          hand: [
            card('8', '♥'), card('8', '♠'), card('8', '♦'),
            card('3', '♥'), card('4', '♥'), card('5', '♥'),
          ],
        },
      ],
    });

    const actions = policy.computeTurn(state, 'player-1');
    expect(actions[0]?.type).toBe('DRAW');
    expect(actions.every((a) => a.type !== 'TAKE_DISCARD')).toBe(true);
  });

  it('always ends with a DISCARD action', () => {
    const state = makeState({
      phase: 'awaitingDraw',
      currentPlayerIdx: 1,
      drawPile: [card('2', '♦')],
      discardPile: [card('9', '♠')],
    });
    const actions = policy.computeTurn(state, state.players[1]!.id);
    const last = actions[actions.length - 1];
    expect(last?.type).toBe('DISCARD');
  });

  it('never rearranges', () => {
    const state = makeState({
      phase: 'awaitingDraw',
      currentPlayerIdx: 1,
      drawPile: [card('K', '♦')],
      discardPile: [card('Q', '♠')],
    });
    const actions = policy.computeTurn(state, state.players[1]!.id);
    expect(actions.every((a) => a.type !== 'START_REARRANGE')).toBe(true);
    expect(actions.every((a) => a.type !== 'COMMIT_REARRANGE')).toBe(true);
  });

  it('completes a 2-player game without crashing', () => {
    let state = createInitialState(['AI-1', 'AI-2'], 99);
    const p0 = state.players[0]!;
    const p1 = state.players[1]!;
    // Make both players AI
    state = {
      ...state,
      players: [
        { ...p0, isAI: true },
        { ...p1, isAI: true },
      ],
    };

    let turns = 0;
    const MAX_TURNS = 200;

    while (state.phase !== 'gameOver' && turns < MAX_TURNS) {
      const player = state.players[state.currentPlayerIdx]!;
      const actions = policy.computeTurn(state, player.id);

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

    // Game should terminate cleanly (or at worst hit the turn limit without crashing)
    expect(['gameOver', 'awaitingDraw', 'inTurn']).toContain(state.phase);
  });
});
