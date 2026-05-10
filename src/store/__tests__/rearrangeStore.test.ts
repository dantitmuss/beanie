import { describe, it, expect, beforeEach } from 'vitest';
import { useRearrangeStore } from '../rearrangeStore';
import type { Card, CardInSet, CardSet, GameState } from '../../engine/types';

function makeCard(rank: string, suit: string, id: string): Card {
  return { id, rank: rank as Card['rank'], suit: suit as Card['suit'] };
}

function makeGameState(hand: Card[], table: CardSet[] = []): GameState {
  return {
    players: [{ id: 'p1', name: 'You', isAI: false, hand, hasOpened: false }],
    turnOrder: ['p1'],
    currentPlayerIdx: 0,
    drawPile: [],
    discardPile: [],
    table,
    phase: 'rearranging',
    rngSeed: 0,
  };
}

beforeEach(() => {
  useRearrangeStore.getState().reset();
});

describe('createSetFromHand', () => {
  it('(a) empty workingTable: creates new set with all 3 cards, hand drained', () => {
    const c1 = makeCard('7', '♣', 'c1');
    const c2 = makeCard('7', '♥', 'c2');
    const c3 = makeCard('7', '♠', 'c3');
    const state = makeGameState([c1, c2, c3]);
    useRearrangeStore.getState().initRearrange(state);

    const cards: CardInSet[] = [{ card: c1 }, { card: c2 }, { card: c3 }];
    const id = useRearrangeStore.getState().createSetFromHand(cards);

    const { workingTable, workingHand } = useRearrangeStore.getState();
    expect(workingTable).toHaveLength(1);
    expect(workingTable[0]!.id).toBe(id);
    expect(workingTable[0]!.cards).toHaveLength(3);
    expect(workingTable[0]!.cards.map((ci) => ci.card.id)).toEqual(['c1', 'c2', 'c3']);
    expect(workingHand).toHaveLength(0);
  });

  it('(b) non-empty workingTable: new set appended, existing sets untouched', () => {
    const existing: CardSet = {
      id: 'existing-set',
      ownerId: 'p1',
      kind: 'group',
      cards: [{ card: makeCard('K', '♣', 'k1') }, { card: makeCard('K', '♥', 'k2') }, { card: makeCard('K', '♠', 'k3') }],
    };
    const c1 = makeCard('7', '♣', 'c1');
    const c2 = makeCard('7', '♥', 'c2');
    const c3 = makeCard('7', '♠', 'c3');
    const state = makeGameState([c1, c2, c3], [existing]);
    useRearrangeStore.getState().initRearrange(state);

    const cards: CardInSet[] = [{ card: c1 }, { card: c2 }, { card: c3 }];
    useRearrangeStore.getState().createSetFromHand(cards);

    const { workingTable, workingHand } = useRearrangeStore.getState();
    expect(workingTable).toHaveLength(2);
    expect(workingTable[0]!.id).toBe('existing-set');
    expect(workingTable[0]!.cards).toHaveLength(3);
    expect(workingTable[1]!.cards.map((ci) => ci.card.id)).toEqual(['c1', 'c2', 'c3']);
    expect(workingHand).toHaveLength(0);
  });
});
