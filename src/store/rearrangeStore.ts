import { create } from 'zustand';
import type { Card, CardInSet, CardSet, GameState } from '../engine/types';
import { isValidSet } from '../engine/sets';
import { canCommitRearrange } from '../engine/rearrange';
import { newId } from '../lib/id';

interface RearrangeStore {
  workingTable: CardSet[];
  workingHand: Card[];
  errors: string[];
  snapshot: GameState | null;

  initRearrange: (state: GameState) => void;
  moveCardToSet: (cardId: string, targetSetId: string | 'new', fromSetId: string | 'hand') => void;
  moveCardToHand: (cardId: string, fromSetId: string) => void;
  getValidationErrors: (snapshot: GameState, activePlayerId: string) => string[];
  buildCommitPayload: () => { nextTable: CardSet[]; nextHand: CardInSet[] };
  reset: () => void;
}

export const useRearrangeStore = create<RearrangeStore>((set, get) => ({
  workingTable: [],
  workingHand: [],
  errors: [],
  snapshot: null,

  initRearrange(state) {
    const humanId = state.players[0]!.id;
    set({
      workingTable: state.table.map((s) => ({ ...s, cards: [...s.cards] })),
      workingHand: [...state.players.find((p) => p.id === humanId)!.hand],
      snapshot: state,
      errors: [],
    });
  },

  moveCardToSet(cardId, targetSetId, fromSetId) {
    const { workingTable, workingHand } = get();

    let cardInSet: CardInSet | undefined;
    let nextHand = workingHand;
    let nextTable = workingTable;

    if (fromSetId === 'hand') {
      const card = workingHand.find((c) => c.id === cardId);
      if (!card) return;
      cardInSet = { card };
      nextHand = workingHand.filter((c) => c.id !== cardId);
    } else {
      const srcSet = workingTable.find((s) => s.id === fromSetId);
      if (!srcSet) return;
      cardInSet = srcSet.cards.find((c) => c.card.id === cardId);
      if (!cardInSet) return;
      nextTable = nextTable.map((s) =>
        s.id === fromSetId
          ? { ...s, cards: s.cards.filter((c) => c.card.id !== cardId) }
          : s,
      ).filter((s) => s.cards.length > 0);
    }

    if (targetSetId === 'new') {
      const humanId = get().snapshot!.players[0]!.id;
      const newSet: CardSet = {
        id: newId('set'),
        ownerId: humanId,
        kind: 'group',
        cards: [cardInSet],
      };
      nextTable = [...nextTable, newSet];
    } else {
      nextTable = nextTable.map((s) =>
        s.id === targetSetId
          ? { ...s, cards: [...s.cards, cardInSet!] }
          : s,
      );
    }

    set({ workingTable: nextTable, workingHand: nextHand });
  },

  moveCardToHand(cardId, fromSetId) {
    const { workingTable, workingHand } = get();
    const srcSet = workingTable.find((s) => s.id === fromSetId);
    if (!srcSet) return;
    const cardInSet = srcSet.cards.find((c) => c.card.id === cardId);
    if (!cardInSet) return;

    const nextTable = workingTable
      .map((s) =>
        s.id === fromSetId
          ? { ...s, cards: s.cards.filter((c) => c.card.id !== cardId) }
          : s,
      )
      .filter((s) => s.cards.length > 0);

    set({ workingTable: nextTable, workingHand: [...workingHand, cardInSet.card] });
  },

  getValidationErrors(snapshot, activePlayerId) {
    const { workingTable, workingHand } = get();
    const errors: string[] = [];

    for (const s of workingTable) {
      const r = isValidSet(s, { minSize: 3 });
      if (!r.ok) errors.push(`Set has invalid cards: ${r.reason}`);
    }

    const tempState: GameState = {
      ...snapshot,
      table: workingTable,
      players: snapshot.players.map((p) =>
        p.id === activePlayerId ? { ...p, hand: workingHand } : p,
      ),
    };

    const result = canCommitRearrange(snapshot, tempState, activePlayerId);
    for (const e of result.errors) {
      if (!errors.includes(e)) errors.push(e);
    }

    return errors;
  },

  buildCommitPayload() {
    const { workingTable, workingHand } = get();
    return {
      nextTable: workingTable,
      nextHand: workingHand.map((c) => ({ card: c })),
    };
  },

  reset() {
    set({ workingTable: [], workingHand: [], errors: [], snapshot: null });
  },
}));
