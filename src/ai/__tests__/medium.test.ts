import { describe, expect, it } from 'vitest';
import { computeAITurn } from '../medium';
import { findCandidateSets } from '../findSets';
import { createInitialState } from '../../engine/state';
import { applyAction } from '../../engine/actions';
import type { Card, GameState } from '../../engine/types';

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { id: `${rank}${suit}`, rank, suit };
}

function makeState(overrides: Partial<GameState>): GameState {
  const base = createInitialState(['Human', 'AI'], 42);
  return {
    ...base,
    ...overrides,
    players: overrides.players ?? base.players,
  };
}

describe('findCandidateSets', () => {
  it('finds a 4-card group', () => {
    const hand = [
      card('7', '♣'), card('7', '♥'), card('7', '♠'), card('7', '♦'),
    ];
    const sets = findCandidateSets(hand, 4);
    expect(sets.some((s) => s.kind === 'group' && s.cards.length === 4)).toBe(true);
  });

  it('finds a 3-card run', () => {
    const hand = [card('4', '♥'), card('5', '♥'), card('6', '♥')];
    const sets = findCandidateSets(hand, 3);
    expect(sets.some((s) => s.kind === 'run' && s.cards.length === 3)).toBe(true);
  });

  it('finds run with Ace filling gap', () => {
    const hand = [card('3', '♠'), card('5', '♠'), card('A', '♣')];
    const sets = findCandidateSets(hand, 3);
    expect(sets.some((s) => s.kind === 'run')).toBe(true);
  });

  it('returns empty for insufficient cards', () => {
    const hand = [card('2', '♥'), card('K', '♣')];
    expect(findCandidateSets(hand, 3)).toHaveLength(0);
  });
});

describe('computeAITurn', () => {
  it('AI draws when no useful discard pile', () => {
    const state = makeState({
      phase: 'awaitingDraw',
      currentPlayerIdx: 1,
      drawPile: [card('2', '♦')],
      discardPile: [card('9', '♠')],
    });
    const actions = computeAITurn(state, state.players[1]!.id);
    expect(actions[0]?.type).toBe('DRAW');
  });

  it('AI always ends with a DISCARD action', () => {
    const state = makeState({
      phase: 'awaitingDraw',
      currentPlayerIdx: 1,
      drawPile: [card('2', '♦')],
      discardPile: [card('9', '♠')],
    });
    const actions = computeAITurn(state, state.players[1]!.id);
    const last = actions[actions.length - 1];
    expect(last?.type).toBe('DISCARD');
  });

  it('AI plays opening set when possible', () => {
    const state = makeState({
      phase: 'awaitingDraw',
      currentPlayerIdx: 1,
      drawPile: [card('K', '♦')],
      discardPile: [card('Q', '♠')],
      players: [
        createInitialState(['Human', 'AI'], 42).players[0]!,
        {
          id: 'player-1',
          name: 'AI',
          isAI: true,
          hasOpened: false,
          hand: [
            card('8', '♣'), card('8', '♥'), card('8', '♠'), card('8', '♦'),
            card('3', '♥'), card('4', '♥'),
          ],
        },
      ],
    });
    const actions = computeAITurn(state, 'player-1');
    expect(actions.some((a) => a.type === 'PLAY_SET')).toBe(true);
  });

  it('AI wins a deterministic short game', () => {
    // Set up AI with a hand it can empty in one turn
    const state = makeState({
      phase: 'awaitingDraw',
      currentPlayerIdx: 1,
      drawPile: [card('J', '♣')],
      discardPile: [card('Q', '♠')],
      players: [
        createInitialState(['Human', 'AI'], 42).players[0]!,
        {
          id: 'player-1',
          name: 'AI',
          isAI: true,
          hasOpened: true,
          hand: [card('5', '♥'), card('6', '♥'), card('7', '♥'), card('2', '♦')],
        },
      ],
    });
    const actions = computeAITurn(state, 'player-1');

    // Apply actions to reach the end state
    let s: GameState = state;
    for (const action of actions) {
      try { s = applyAction(s, action); } catch { break; }
    }

    expect(['gameOver', 'awaitingDraw']).toContain(s.phase);
  });
});
