import { describe, expect, it } from 'vitest';
import { BeanieRoom } from '../room-state';
import { sanitizeAction } from '../sanitize';
import { currentPlayer } from '../../src/engine/state';
import type { Card, CardInSet } from '../../src/engine/types';

function startedRoom() {
  const room = new BeanieRoom();
  room.hello('session-0', 'Dan', 'create');
  room.hello('session-1', 'Aria', 'join');
  room.start(room.hostId!, 42);
  const engineId = currentPlayer(room.game!).id;
  const seat = room.seats.find((s) => s.engineId === engineId)!;
  // draw so PLAY_SET / DISCARD become legal
  room.applyGameAction(seat.id, { type: 'DRAW' });
  const hand = room.game!.players.find((p) => p.id === engineId)!.hand;
  return { room, seat, engineId, hand };
}

function forge(card: Card, rank: Card['rank'], suit: Card['suit']): CardInSet {
  return { card: { id: card.id, rank, suit } };
}

describe('forged card faces', () => {
  it('PLAY_SET with forged ranks/suits is judged on the real cards', () => {
    const { room, seat, engineId, hand } = startedRoom();
    // claim three arbitrary hand cards are a 7-7-7 group
    const forged = [
      forge(hand[0]!, '7', '♣'),
      forge(hand[1]!, '7', '♦'),
      forge(hand[2]!, '7', '♥'),
      forge(hand[3]!, '7', '♠'),
    ];
    const result = room.applyGameAction(seat.id, {
      type: 'PLAY_SET',
      ownerId: engineId,
      cards: forged,
    });

    // seed 42 deals no natural 4-of-a-kind in the first 4 cards; the forged
    // claim must be re-evaluated against the canonical cards and rejected
    const realRanks = hand.slice(0, 4).map((c) => c.rank);
    expect(new Set(realRanks).size).toBeGreaterThan(1);
    expect(result.ok).toBe(false);

    // and nothing reached the table
    expect(room.game!.table).toHaveLength(0);
  });

  it('sanitizeAction restores canonical faces while keeping ids', () => {
    const { room, engineId, hand } = startedRoom();
    const forged = [forge(hand[0]!, 'K', '♠')];
    const result = sanitizeAction(room.game!, {
      type: 'PLAY_SET',
      ownerId: engineId,
      cards: forged,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.action.type === 'PLAY_SET') {
      expect(result.action.cards[0]!.card).toEqual(hand[0]);
    }
  });

  it('rejects cards with ids that do not exist in the game', () => {
    const { room, engineId } = startedRoom();
    const result = sanitizeAction(room.game!, {
      type: 'PLAY_SET',
      ownerId: engineId,
      cards: [{ card: { id: 'made-up-card', rank: 'A', suit: '♠' } }],
    });
    expect(result).toMatchObject({ ok: false, message: 'Unknown card' });
  });

  it('rejects aceRole on non-ace cards and malformed roles', () => {
    const { room, engineId, hand } = startedRoom();
    const nonAce = hand.find((c) => c.rank !== 'A')!;
    const onNonAce = sanitizeAction(room.game!, {
      type: 'PLAY_SET',
      ownerId: engineId,
      cards: [{ card: nonAce, aceRole: { rank: 'K', suit: '♠' } }],
    });
    expect(onNonAce.ok).toBe(false);

    const garbageRole = sanitizeAction(room.game!, {
      type: 'PLAY_SET',
      ownerId: engineId,
      cards: [{ card: nonAce, aceRole: { rank: '<script>', suit: 'x' } as never }],
    });
    expect(garbageRole.ok).toBe(false);
  });

  it('COMMIT_REARRANGE rejects fabricated cards and unknown owners', () => {
    const { room, engineId, hand } = startedRoom();
    const fabricated = sanitizeAction(room.game!, {
      type: 'COMMIT_REARRANGE',
      nextTable: [
        {
          id: 'set-x',
          ownerId: engineId,
          kind: 'group',
          cards: [{ card: { id: 'ghost', rank: 'K', suit: '♠' } }],
        },
      ],
      nextHand: hand.map((card) => ({ card })),
    });
    expect(fabricated.ok).toBe(false);

    const badOwner = sanitizeAction(room.game!, {
      type: 'COMMIT_REARRANGE',
      nextTable: [
        { id: 'set-x', ownerId: 'player-99', kind: 'group', cards: [{ card: hand[0]! }] },
      ],
      nextHand: [],
    });
    expect(badOwner).toMatchObject({ ok: false, message: 'Malformed set' });
  });

  it('passes simple actions through untouched', () => {
    const { room } = startedRoom();
    const result = sanitizeAction(room.game!, { type: 'DISCARD', cardId: 'whatever' });
    expect(result).toEqual({ ok: true, action: { type: 'DISCARD', cardId: 'whatever' } });
  });
});

describe('malformed HELLO fields', () => {
  it('rejects non-string or oversized session ids', () => {
    const room = new BeanieRoom();
    expect(room.hello({} as never, 'Dan', 'create').ok).toBe(false);
    expect(room.hello('', 'Dan', 'create').ok).toBe(false);
    expect(room.hello('x'.repeat(65), 'Dan', 'create').ok).toBe(false);
    expect(room.seats).toHaveLength(0);
  });

  it('tolerates a non-string display name', () => {
    const room = new BeanieRoom();
    const result = room.hello('session-0', 12345 as never, 'create');
    expect(result.ok && result.seat.name).toBe('Player');
  });
});
