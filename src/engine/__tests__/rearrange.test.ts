import { describe, expect, it } from 'vitest';
import type { Card, CardInSet, CardSet, GameState, Player } from '../types';
import { canCommitRearrange, validateTable } from '../rearrange';

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { id: `${rank}${suit}`, rank, suit };
}

function ci(c: Card): CardInSet {
  return { card: c };
}

function makeSet(
  id: string,
  kind: CardSet['kind'],
  cards: CardInSet[],
  ownerId: string,
): CardSet {
  return { id, ownerId, kind, cards };
}

function makePlayer(id: string, hand: Card[], hasOpened: boolean): Player {
  return { id, name: id, isAI: false, hand, hasOpened };
}

function makeState(
  players: Player[],
  table: CardSet[],
  phase: GameState['phase'] = 'rearranging',
): GameState {
  return {
    players,
    turnOrder: players.map((p) => p.id),
    currentPlayerIdx: 0,
    drawPile: [],
    discardPile: [],
    table,
    phase,
    rngSeed: 42,
  };
}

describe('validateTable', () => {
  it('valid state: all sets valid, opening protection satisfied', () => {
    const p1 = makePlayer('p1', [], true);
    const p2 = makePlayer('p2', [], true);
    const table = [
      makeSet('s1', 'group', [
        ci(card('7', '♣')), ci(card('7', '♥')), ci(card('7', '♠')), ci(card('7', '♦')),
      ], 'p1'),
      makeSet('s2', 'group', [
        ci(card('8', '♣')), ci(card('8', '♥')), ci(card('8', '♠')), ci(card('8', '♦')),
      ], 'p2'),
    ];
    const state = makeState([p1, p2], table);
    const r = validateTable(state, { activePlayerId: 'p1', openingProtection: ['p2'] });
    expect(r.ok).toBe(true);
  });

  it('fails when opening-protected player has only 3-card sets', () => {
    const p1 = makePlayer('p1', [], true);
    const p2 = makePlayer('p2', [], true);
    const table = [
      makeSet('s1', 'group', [
        ci(card('7', '♣')), ci(card('7', '♥')), ci(card('7', '♠')), ci(card('7', '♦')),
      ], 'p1'),
      makeSet('s2', 'group', [
        ci(card('8', '♣')), ci(card('8', '♥')), ci(card('8', '♠')),
      ], 'p2'),
    ];
    const state = makeState([p1, p2], table);
    const r = validateTable(state, { activePlayerId: 'p1', openingProtection: ['p2'] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('p2'))).toBe(true);
  });

  it('fails when an invalid set is present', () => {
    const p1 = makePlayer('p1', [], true);
    const table = [
      makeSet('s1', 'group', [
        ci(card('7', '♣')), ci(card('8', '♥')),
      ], 'p1'),
    ];
    const state = makeState([p1], table);
    const r = validateTable(state, { activePlayerId: 'p1', openingProtection: [] });
    expect(r.ok).toBe(false);
  });
});

describe('canCommitRearrange', () => {
  it('accepts valid rearrangement: player adds hand card to existing table set', () => {
    // p1 holds 7♣ and there's a 3-card group of 7s on the table.
    // After rearrange, p1 plays 7♣ into the group making it 4-card.
    const c7c = card('7', '♣');
    const c7h = card('7', '♥');
    const c7s = card('7', '♠');
    const c7d = card('7', '♦');

    const p1 = makePlayer('p1', [c7c], true);
    const prev = makeState(
      [p1],
      [makeSet('s1', 'group', [ci(c7h), ci(c7s), ci(c7d)], 'p1')],
    );

    const p1next = makePlayer('p1', [], true);
    const next = makeState(
      [p1next],
      [makeSet('s1', 'group', [ci(c7h), ci(c7s), ci(c7d), ci(c7c)], 'p1')],
    );

    const r = canCommitRearrange(prev, next, 'p1');
    expect(r.ok).toBe(true);
  });

  it('rejects when active player adds card from nowhere', () => {
    const phantom = card('K', '♠');
    const p1 = makePlayer('p1', [], true);
    const prev = makeState([p1], []);
    const next = makeState(
      [p1],
      [makeSet('s1', 'group', [ci(phantom), ci(card('K', '♥')), ci(card('K', '♣'))], 'p1')],
    );
    const r = canCommitRearrange(prev, next, 'p1');
    expect(r.ok).toBe(false);
  });

  it('rejects when another player loses a card', () => {
    const c = card('5', '♥');
    const p1 = makePlayer('p1', [], true);
    const p2before = makePlayer('p2', [c], true);
    const p2after = makePlayer('p2', [], true);

    const set = makeSet('s1', 'group', [
      ci(card('8', '♣')), ci(card('8', '♥')), ci(card('8', '♠')), ci(card('8', '♦')),
    ], 'p1');
    const prev = makeState([p1, p2before], [set]);
    const next = makeState([p1, p2after], [set]);

    const r = canCommitRearrange(prev, next, 'p1');
    expect(r.ok).toBe(false);
  });

  it('rejects when opening protection is violated', () => {
    const c1 = card('9', '♣');
    const c2 = card('9', '♥');
    const c3 = card('9', '♠');
    const c4 = card('9', '♦');

    const p1 = makePlayer('p1', [c4], true);
    const p2 = makePlayer('p2', [], true);

    const prev = makeState(
      [p1, p2],
      [makeSet('s1', 'group', [ci(c1), ci(c2), ci(c3), ci(c4)], 'p2')],
    );

    const next = makeState(
      [makePlayer('p1', [], true), p2],
      [makeSet('s1', 'group', [ci(c1), ci(c2), ci(c3)], 'p2')],
    );

    const r = canCommitRearrange(prev, next, 'p1');
    expect(r.ok).toBe(false);
  });
});
