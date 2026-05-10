import type { Card, CardInSet, CardSet } from '../engine/types';
import { isValidSet } from '../engine/sets';
import { rankIndex, RANK_ORDER } from '../engine/sets';
import { newId } from '../lib/id';

export interface ExtendResult {
  setId: string;
  newCards: CardInSet[];
}

export function tryExtend(handCard: Card, tableSets: CardSet[]): ExtendResult | null {
  for (const set of tableSets) {
    const extended = tryAddToSet(handCard, set);
    if (extended) {
      return { setId: set.id, newCards: extended };
    }
  }
  return null;
}

function tryAddToSet(card: Card, set: CardSet): CardInSet[] | null {
  if (set.kind === 'group') {
    return tryAddToGroup(card, set);
  } else {
    return tryAddToRun(card, set);
  }
}

function tryAddToGroup(card: Card, set: CardSet): CardInSet[] | null {
  if (set.cards.length >= 4) return null;

  const nonAces = set.cards.filter((c) => c.card.rank !== 'A');
  const groupRank = nonAces[0]?.card.rank;
  if (!groupRank) return null;

  const existingSuits = new Set(set.cards.map((c) => c.aceRole?.suit ?? c.card.suit));

  if (card.rank === 'A') {
    // Find a missing suit
    for (const suit of ['♣', '♦', '♥', '♠'] as const) {
      if (!existingSuits.has(suit)) {
        const newCards: CardInSet[] = [
          ...set.cards,
          { card, aceRole: { rank: groupRank as Exclude<Card['rank'], 'A'>, suit } },
        ];
        const tmp: CardSet = { ...set, id: newId('tmp'), cards: newCards };
        if (isValidSet(tmp, { minSize: 3 }).ok) return newCards;
      }
    }
    return null;
  }

  if (card.rank !== groupRank) return null;
  if (existingSuits.has(card.suit)) return null;

  const newCards: CardInSet[] = [...set.cards, { card }];
  const tmp: CardSet = { ...set, id: newId('tmp'), cards: newCards };
  return isValidSet(tmp, { minSize: 3 }).ok ? newCards : null;
}

function tryAddToRun(card: Card, set: CardSet): CardInSet[] | null {
  const nonAces = set.cards.filter((c) => c.card.rank !== 'A');
  const runSuit = nonAces[0]?.card.suit;
  if (!runSuit) return null;

  if (card.rank !== 'A' && card.suit !== runSuit) return null;

  const effectiveIndices = set.cards.map((c) => {
    const r = c.aceRole?.rank ?? (c.card.rank !== 'A' ? c.card.rank : null);
    if (!r) return -1;
    return rankIndex(r as Exclude<Card['rank'], 'A'>);
  }).filter((i) => i >= 0);

  effectiveIndices.sort((a, b) => a - b);
  const minIdx = effectiveIndices[0]!;
  const maxIdx = effectiveIndices[effectiveIndices.length - 1]!;

  if (card.rank === 'A') {
    // Try extending at low end
    if (minIdx > 0) {
      const newRank = RANK_ORDER[minIdx - 1]!;
      const newCards: CardInSet[] = [
        ...set.cards,
        { card, aceRole: { rank: newRank, suit: runSuit } },
      ];
      const tmp: CardSet = { ...set, id: newId('tmp'), cards: newCards };
      if (isValidSet(tmp, { minSize: 3 }).ok) return newCards;
    }
    // Try extending at high end
    if (maxIdx < 11) {
      const newRank = RANK_ORDER[maxIdx + 1]!;
      const newCards: CardInSet[] = [
        ...set.cards,
        { card, aceRole: { rank: newRank, suit: runSuit } },
      ];
      const tmp: CardSet = { ...set, id: newId('tmp'), cards: newCards };
      if (isValidSet(tmp, { minSize: 3 }).ok) return newCards;
    }
    return null;
  }

  const cardIdx = rankIndex(card.rank as Exclude<Card['rank'], 'A'>);

  // Check if card extends at either end
  if (cardIdx === minIdx - 1 || cardIdx === maxIdx + 1) {
    const newCards: CardInSet[] = [...set.cards, { card }];
    const tmp: CardSet = { ...set, id: newId('tmp'), cards: newCards };
    return isValidSet(tmp, { minSize: 3 }).ok ? newCards : null;
  }

  return null;
}

export function tryAceReplacement(
  handCard: Card,
  tableSets: CardSet[],
): { setId: string; newCards: CardInSet[]; freedAce: Card } | null {
  if (handCard.rank === 'A') return null;

  for (const set of tableSets) {
    const aceInSet = set.cards.find((c) => c.card.rank === 'A' && c.aceRole);
    if (!aceInSet?.aceRole) continue;

    if (
      aceInSet.aceRole.rank === handCard.rank &&
      aceInSet.aceRole.suit === handCard.suit
    ) {
      const newCards = set.cards.map((c) =>
        c.card.id === aceInSet.card.id ? { card: handCard } : c,
      );
      const tmp: CardSet = { ...set, id: newId('tmp'), cards: newCards };
      if (isValidSet(tmp, { minSize: 3 }).ok) {
        return {
          setId: set.id,
          newCards,
          freedAce: aceInSet.card,
        };
      }
    }
  }
  return null;
}
