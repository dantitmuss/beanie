import { describe, expect, it } from 'vitest';
import type { Card, CardInSet, CardSet } from '../types';
import { inferAceRoles, isValidSet } from '../sets';

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { id: `${rank}${suit}`, rank, suit };
}

function ci(c: Card, aceRole?: CardInSet['aceRole']): CardInSet {
  return { card: c, aceRole };
}

function makeSet(
  kind: CardSet['kind'],
  cards: CardInSet[],
  ownerId = 'p1',
): CardSet {
  return { id: 'test', ownerId, kind, cards };
}

describe('isValidSet — groups', () => {
  it('valid 3-card group', () => {
    const s = makeSet('group', [
      ci(card('7', '♣')),
      ci(card('7', '♥')),
      ci(card('7', '♠')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(true);
  });

  it('valid 4-card group', () => {
    const s = makeSet('group', [
      ci(card('7', '♣')),
      ci(card('7', '♥')),
      ci(card('7', '♠')),
      ci(card('7', '♦')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(true);
  });

  it('rejects group with mismatched ranks', () => {
    const s = makeSet('group', [
      ci(card('7', '♣')),
      ci(card('8', '♥')),
      ci(card('7', '♠')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('rejects group with duplicate suits', () => {
    const s = makeSet('group', [
      ci(card('7', '♣')),
      ci(card('7', '♥')),
      ci(card('7', '♣')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('rejects group with 5+ cards', () => {
    const s = makeSet('group', [
      ci(card('7', '♣')),
      ci(card('7', '♥')),
      ci(card('7', '♠')),
      ci(card('7', '♦')),
      ci(card('A', '♣'), { rank: '7', suit: '♣' }),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('rejects under-minSize (opening)', () => {
    const s = makeSet('group', [
      ci(card('7', '♣')),
      ci(card('7', '♥')),
      ci(card('7', '♠')),
    ]);
    expect(isValidSet(s, { minSize: 4 }).ok).toBe(false);
  });

  it('valid 3-card group with one Ace', () => {
    const ace = card('A', '♣');
    const s = makeSet('group', [
      ci(card('K', '♥')),
      ci(card('K', '♦')),
      ci(ace, { rank: 'K', suit: '♠' }),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(true);
  });

  it('rejects Ace with wrong rank for group', () => {
    const ace = card('A', '♣');
    const s = makeSet('group', [
      ci(card('K', '♥')),
      ci(card('K', '♦')),
      ci(ace, { rank: 'Q', suit: '♠' }),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('rejects Ace with no role in group', () => {
    const ace = card('A', '♣');
    const s = makeSet('group', [
      ci(card('K', '♥')),
      ci(card('K', '♦')),
      ci(ace),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('rejects Ace role that duplicates existing suit', () => {
    const ace = card('A', '♣');
    const s = makeSet('group', [
      ci(card('K', '♥')),
      ci(card('K', '♦')),
      ci(ace, { rank: 'K', suit: '♥' }),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });
});

describe('isValidSet — runs', () => {
  it('valid 3-card run', () => {
    const s = makeSet('run', [
      ci(card('3', '♥')),
      ci(card('4', '♥')),
      ci(card('5', '♥')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(true);
  });

  it('valid long run', () => {
    const s = makeSet('run', [
      ci(card('9', '♠')),
      ci(card('10', '♠')),
      ci(card('J', '♠')),
      ci(card('Q', '♠')),
      ci(card('K', '♠')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(true);
  });

  it('rejects mixed suits', () => {
    const s = makeSet('run', [
      ci(card('3', '♥')),
      ci(card('4', '♣')),
      ci(card('5', '♥')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('rejects non-consecutive run', () => {
    const s = makeSet('run', [
      ci(card('3', '♥')),
      ci(card('4', '♥')),
      ci(card('6', '♥')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('rejects run with duplicate rank', () => {
    const s = makeSet('run', [
      ci(card('3', '♥')),
      ci(card('3', '♥')),
      ci(card('4', '♥')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('Ace in middle of run (unambiguous)', () => {
    const ace = card('A', '♣');
    const s = makeSet('run', [
      ci(card('3', '♥')),
      ci(card('4', '♥')),
      ci(ace, { rank: '5', suit: '♥' }),
      ci(card('6', '♥')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(true);
  });

  it('Ace at top as K', () => {
    const ace = card('A', '♣');
    const s = makeSet('run', [
      ci(card('J', '♠')),
      ci(card('Q', '♠')),
      ci(ace, { rank: 'K', suit: '♠' }),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(true);
  });

  it('rejects run with wrong Ace suit', () => {
    const ace = card('A', '♣');
    const s = makeSet('run', [
      ci(card('3', '♥')),
      ci(card('4', '♥')),
      ci(ace, { rank: '5', suit: '♦' }),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('rejects run below minimum size', () => {
    const s = makeSet('run', [
      ci(card('3', '♥')),
      ci(card('4', '♥')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(false);
  });

  it('run from 2 to K is valid (full 12-card run)', () => {
    const s = makeSet('run', [
      ci(card('2', '♣')),
      ci(card('3', '♣')),
      ci(card('4', '♣')),
      ci(card('5', '♣')),
      ci(card('6', '♣')),
      ci(card('7', '♣')),
      ci(card('8', '♣')),
      ci(card('9', '♣')),
      ci(card('10', '♣')),
      ci(card('J', '♣')),
      ci(card('Q', '♣')),
      ci(card('K', '♣')),
    ]);
    expect(isValidSet(s, { minSize: 3 }).ok).toBe(true);
  });
});

describe('inferAceRoles', () => {
  it('no Aces — returns cards unchanged', () => {
    const cards = [card('3', '♥'), card('4', '♥'), card('5', '♥')];
    const r = inferAceRoles(cards, { kind: 'run' });
    expect(r.ok).toBe(true);
    expect(r.cards?.length).toBe(3);
  });

  it('group: Ace fills missing suit', () => {
    const ace = card('A', '♣');
    const r = inferAceRoles(
      [card('Q', '♥'), card('Q', '♦'), ace],
      { kind: 'group' },
    );
    expect(r.ok).toBe(true);
    const aceCard = r.cards?.find((c) => c.card.rank === 'A');
    expect(aceCard?.aceRole?.rank).toBe('Q');
    expect(['♣', '♠']).toContain(aceCard?.aceRole?.suit);
  });

  it('run: unambiguous Ace in gap', () => {
    const ace = card('A', '♦');
    const r = inferAceRoles(
      [card('3', '♥'), card('4', '♥'), ace, card('6', '♥')],
      { kind: 'run', suit: '♥' },
    );
    expect(r.ok).toBe(true);
    const aceCard = r.cards?.find((c) => c.card.rank === 'A');
    expect(aceCard?.aceRole).toEqual({ rank: '5', suit: '♥' });
  });

  it('run: ambiguous Ace at the edge returns ambiguous', () => {
    const ace = card('A', '♣');
    const r = inferAceRoles(
      [card('5', '♥'), card('6', '♥'), ace],
      { kind: 'run', suit: '♥' },
    );
    expect(r.ok).toBe(false);
    expect(r.ambiguous).toBeDefined();
    expect(r.ambiguous!.length).toBeGreaterThan(1);
  });

  it('run: Ace at low end, forced by K boundary (Ace=J)', () => {
    const ace = card('A', '♣');
    const r = inferAceRoles(
      [card('Q', '♠'), card('K', '♠'), ace],
      { kind: 'run', suit: '♠' },
    );
    // Q=10, K=11 — only window is [9,10,11], so Ace=J
    expect(r.ok).toBe(true);
    const aceCard = r.cards?.find((c) => c.card.rank === 'A');
    expect(aceCard?.aceRole).toEqual({ rank: 'J', suit: '♠' });
  });

  it('run: Ace at high end, forced by 2 boundary (Ace=4)', () => {
    const ace = card('A', '♣');
    const r = inferAceRoles(
      [card('2', '♠'), card('3', '♠'), ace],
      { kind: 'run', suit: '♠' },
    );
    // 2=0, 3=1 — only window is [0,1,2], so Ace=4
    expect(r.ok).toBe(true);
    const aceCard = r.cards?.find((c) => c.card.rank === 'A');
    expect(aceCard?.aceRole).toEqual({ rank: '4', suit: '♠' });
  });

  it('run: Ace at edge is ambiguous when two windows fit', () => {
    const ace = card('A', '♣');
    const r = inferAceRoles(
      [card('J', '♠'), card('Q', '♠'), ace],
      { kind: 'run', suit: '♠' },
    );
    // J=9, Q=10 — windows [8,9,10] (Ace=10) and [9,10,11] (Ace=K) both valid
    expect(r.ok).toBe(false);
    expect(r.ambiguous).toBeDefined();
    expect(r.ambiguous!.length).toBe(2);
  });
});
