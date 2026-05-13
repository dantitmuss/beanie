import type { Card, CardInSet, CardSet } from '../engine/types';
import { isValidSet, rankIndex, RANK_ORDER } from '../engine/sets';
import { tryAceReplacement } from './tryExtend';
import { newId } from '../lib/id';

export interface RearrangeResult {
  nextTable: CardSet[];
  nextHand: CardInSet[];
}

// Replace an ace in a table set with a matching hand card, freeing the ace to hand.
export function findAceReplacement(hand: Card[], table: CardSet[]): RearrangeResult | null {
  for (const card of hand) {
    const rep = tryAceReplacement(card, table);
    if (!rep) continue;

    const nextTable = table.map((s) =>
      s.id === rep.setId ? { ...s, cards: rep.newCards } : s,
    );
    const nextHand: CardInSet[] = [
      ...hand.filter((c) => c.id !== card.id).map((c) => ({ card: c })),
      { card: rep.freedAce },
    ];

    return { nextTable, nextHand };
  }
  return null;
}

// Merge two same-suit runs on the table using a hand card as the bridge rank.
export function findBridgeMerge(hand: Card[], table: CardSet[]): RearrangeResult | null {
  // Only consider ace-free runs for simplicity
  const runs = table.filter(
    (s) => s.kind === 'run' && s.cards.every((c) => c.card.rank !== 'A'),
  );

  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const r1 = runs[i]!;
      const r2 = runs[j]!;

      const r1suit = r1.cards[0]!.card.suit;
      const r2suit = r2.cards[0]!.card.suit;
      if (r1suit !== r2suit) continue;

      const r1idxs = r1.cards.map((c) =>
        rankIndex(c.card.rank as Exclude<Card['rank'], 'A'>),
      );
      const r2idxs = r2.cards.map((c) =>
        rankIndex(c.card.rank as Exclude<Card['rank'], 'A'>),
      );

      const r1max = Math.max(...r1idxs);
      const r1min = Math.min(...r1idxs);
      const r2max = Math.max(...r2idxs);
      const r2min = Math.min(...r2idxs);

      // Determine which run is lower vs higher; skip if they overlap or aren't separated by 1
      let lowMax: number, highMin: number, lowSet: CardSet, highSet: CardSet;
      if (r1max < r2min) {
        lowMax = r1max; highMin = r2min; lowSet = r1; highSet = r2;
      } else if (r2max < r1min) {
        lowMax = r2max; highMin = r1min; lowSet = r2; highSet = r1;
      } else {
        continue; // overlapping or adjacent ranges
      }

      if (highMin - lowMax !== 2) continue; // not a single-card gap

      const bridgeIdx = lowMax + 1;
      const bridgeRank = RANK_ORDER[bridgeIdx];
      if (!bridgeRank) continue;

      const bridgeCard = hand.find((c) => c.rank === bridgeRank && c.suit === r1suit);
      if (!bridgeCard) continue;

      const mergedCards: CardInSet[] = [
        ...lowSet.cards,
        { card: bridgeCard },
        ...highSet.cards,
      ];

      const tmpSet: CardSet = { ...lowSet, id: newId('tmp'), cards: mergedCards };
      if (!isValidSet(tmpSet, { minSize: 3 }).ok) continue;

      const mergedSet: CardSet = { ...lowSet, cards: mergedCards };
      const nextTable = table
        .filter((s) => s.id !== lowSet.id && s.id !== highSet.id)
        .concat([mergedSet]);
      const nextHand: CardInSet[] = hand
        .filter((c) => c.id !== bridgeCard.id)
        .map((c) => ({ card: c }));

      return { nextTable, nextHand };
    }
  }
  return null;
}

// Try all cheap patterns in priority order; returns the first match.
export function applyRearrangePatterns(
  hand: Card[],
  table: CardSet[],
): RearrangeResult | null {
  return findAceReplacement(hand, table) ?? findBridgeMerge(hand, table);
}
