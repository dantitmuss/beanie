import { describe, expect, it, beforeEach } from 'vitest';
import type { Card, CardInSet, GameState, Player } from '../types';
import { applyAction } from '../actions';
import { createInitialState } from '../state';
import { resetIdCounter } from '../../lib/id';

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { id: `${rank}${suit}`, rank, suit };
}

function ci(c: Card, aceRole?: CardInSet['aceRole']): CardInSet {
  return { card: c, aceRole };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const p1: Player = { id: 'p1', name: 'Human', isAI: false, hand: [], hasOpened: false };
  const p2: Player = { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false };
  return {
    players: [p1, p2],
    turnOrder: ['p1', 'p2'],
    currentPlayerIdx: 0,
    drawPile: [],
    discardPile: [],
    table: [],
    phase: 'awaitingDraw',
    rngSeed: 42,
    ...overrides,
  };
}

beforeEach(() => resetIdCounter());

describe('DRAW', () => {
  it('moves top card to active player hand', () => {
    const c = card('5', '♥');
    const state = makeState({ drawPile: [c] });
    const next = applyAction(state, { type: 'DRAW' });
    expect(next.players[0]!.hand).toContain(c);
    expect(next.drawPile).toHaveLength(0);
    expect(next.phase).toBe('inTurn');
  });

  it('throws if not in awaitingDraw phase', () => {
    const state = makeState({ phase: 'inTurn', drawPile: [card('5', '♥')] });
    expect(() => applyAction(state, { type: 'DRAW' })).toThrow();
  });

  it('throws if draw pile is empty', () => {
    const state = makeState({ drawPile: [] });
    expect(() => applyAction(state, { type: 'DRAW' })).toThrow();
  });
});

describe('TAKE_DISCARD', () => {
  it('moves all discard cards to active player hand', () => {
    const cards = [card('5', '♥'), card('6', '♦'), card('7', '♣')];
    const state = makeState({ discardPile: cards });
    const next = applyAction(state, { type: 'TAKE_DISCARD' });
    expect(next.players[0]!.hand).toHaveLength(3);
    expect(next.discardPile).toHaveLength(0);
    expect(next.phase).toBe('inTurn');
  });

  it('throws if discard pile is empty', () => {
    const state = makeState({ discardPile: [] });
    expect(() => applyAction(state, { type: 'TAKE_DISCARD' })).toThrow();
  });
});

describe('PLAY_SET', () => {
  it('plays a valid 4-card opening group', () => {
    const hand = [card('7', '♣'), card('7', '♥'), card('7', '♠'), card('7', '♦')];
    const state = makeState({ phase: 'inTurn', players: [
      { id: 'p1', name: 'Human', isAI: false, hand, hasOpened: false },
      { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
    ]});
    const next = applyAction(state, {
      type: 'PLAY_SET',
      ownerId: 'p1',
      cards: hand.map((c) => ci(c)),
    });
    expect(next.table).toHaveLength(1);
    expect(next.players[0]!.hand).toHaveLength(0);
    expect(next.players[0]!.hasOpened).toBe(true);
  });

  it('rejects a 3-card set as opening (minSize 4)', () => {
    const hand = [card('7', '♣'), card('7', '♥'), card('7', '♠')];
    const state = makeState({ phase: 'inTurn', players: [
      { id: 'p1', name: 'Human', isAI: false, hand, hasOpened: false },
      { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
    ]});
    expect(() =>
      applyAction(state, {
        type: 'PLAY_SET',
        ownerId: 'p1',
        cards: hand.map((c) => ci(c)),
      }),
    ).toThrow();
  });

  it('allows 3-card set after opening', () => {
    const hand = [card('J', '♣'), card('J', '♥'), card('J', '♠')];
    const state = makeState({ phase: 'inTurn', players: [
      { id: 'p1', name: 'Human', isAI: false, hand, hasOpened: true },
      { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
    ]});
    const next = applyAction(state, {
      type: 'PLAY_SET',
      ownerId: 'p1',
      cards: hand.map((c) => ci(c)),
    });
    expect(next.table).toHaveLength(1);
  });

  it('rejects playing cards not in hand', () => {
    const notInHand = card('K', '♠');
    const state = makeState({ phase: 'inTurn', players: [
      { id: 'p1', name: 'Human', isAI: false, hand: [], hasOpened: true },
      { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
    ]});
    expect(() =>
      applyAction(state, {
        type: 'PLAY_SET',
        ownerId: 'p1',
        cards: [ci(notInHand), ci(card('K', '♥')), ci(card('K', '♣'))],
      }),
    ).toThrow();
  });
});

describe('DISCARD', () => {
  it('moves card to discard pile and advances turn', () => {
    const c = card('9', '♣');
    const state = makeState({ phase: 'inTurn', players: [
      { id: 'p1', name: 'Human', isAI: false, hand: [c, card('2', '♥')], hasOpened: true },
      { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
    ]});
    const next = applyAction(state, { type: 'DISCARD', cardId: c.id });
    expect(next.discardPile[0]).toEqual(c);
    expect(next.players[0]!.hand).toHaveLength(1);
    expect(next.currentPlayerIdx).toBe(1);
    expect(next.phase).toBe('awaitingDraw');
  });

  it('triggers win when hand empty and player has opened', () => {
    const c = card('9', '♣');
    const state = makeState({ phase: 'inTurn', players: [
      { id: 'p1', name: 'Human', isAI: false, hand: [c], hasOpened: true },
      { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
    ]});
    const next = applyAction(state, { type: 'DISCARD', cardId: c.id });
    expect(next.phase).toBe('gameOver');
    expect(next.winner).toBe('p1');
  });

  it('does not win when hand empty but player has not opened', () => {
    const c = card('9', '♣');
    const state = makeState({ phase: 'inTurn', players: [
      { id: 'p1', name: 'Human', isAI: false, hand: [c], hasOpened: false },
      { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
    ]});
    const next = applyAction(state, { type: 'DISCARD', cardId: c.id });
    expect(next.phase).toBe('awaitingDraw');
    expect(next.winner).toBeUndefined();
  });

  it('replenishes draw pile when it is empty after discard', () => {
    const c = card('9', '♣');
    const d1 = card('2', '♦');
    const d2 = card('3', '♦');
    const d3 = card('4', '♦');
    const state = makeState({
      phase: 'inTurn',
      players: [
        { id: 'p1', name: 'Human', isAI: false, hand: [c, card('5', '♠')], hasOpened: false },
        { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
      ],
      drawPile: [],
      discardPile: [d1, d2, d3],
    });
    const next = applyAction(state, { type: 'DISCARD', cardId: c.id });
    expect(next.drawPile.length).toBe(3);
    expect(next.discardPile).toHaveLength(1);
    expect(next.discardPile[0]).toEqual(c);
  });

  it('throws when card not in hand', () => {
    const state = makeState({ phase: 'inTurn' });
    expect(() => applyAction(state, { type: 'DISCARD', cardId: 'ghost' })).toThrow();
  });
});

describe('REARRANGE lifecycle', () => {
  it('START_REARRANGE snapshots state', () => {
    const state = makeState({ phase: 'inTurn', players: [
      { id: 'p1', name: 'Human', isAI: false, hand: [], hasOpened: true },
      { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
    ]});
    const next = applyAction(state, { type: 'START_REARRANGE' });
    expect(next.phase).toBe('rearranging');
    expect(next.rearrangeSnapshot).toBeDefined();
  });

  it('START_REARRANGE throws if not opened', () => {
    const state = makeState({ phase: 'inTurn' });
    expect(() => applyAction(state, { type: 'START_REARRANGE' })).toThrow();
  });

  it('CANCEL_REARRANGE restores snapshot', () => {
    const snap = makeState({ phase: 'inTurn', players: [
      { id: 'p1', name: 'Human', isAI: false, hand: [], hasOpened: true },
      { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
    ]});
    const rearranging = makeState({
      phase: 'rearranging',
      rearrangeSnapshot: snap,
      players: [
        { id: 'p1', name: 'Human', isAI: false, hand: [], hasOpened: true },
        { id: 'p2', name: 'AI', isAI: true, hand: [], hasOpened: false },
      ],
    });
    const restored = applyAction(rearranging, { type: 'CANCEL_REARRANGE' });
    expect(restored).toEqual(snap);
  });
});

describe('createInitialState', () => {
  it('creates state with correct card count', () => {
    const state = createInitialState(['Human', 'AI'], 42);
    expect(state.players[0]!.hand).toHaveLength(9);
    expect(state.players[1]!.hand).toHaveLength(9);
    expect(state.discardPile).toHaveLength(1);
    expect(state.drawPile.length + 18 + 1).toBe(52);
  });

  it('is deterministic from same seed', () => {
    const a = createInitialState(['Human', 'AI'], 12345);
    const b = createInitialState(['Human', 'AI'], 12345);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('differs with different seeds', () => {
    const a = createInitialState(['Human', 'AI'], 1);
    const b = createInitialState(['Human', 'AI'], 2);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});
