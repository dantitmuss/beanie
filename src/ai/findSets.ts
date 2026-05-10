import type { Card, CardInSet, CardSet } from '../engine/types';
import { rankIndex, RANK_ORDER, SUITS } from '../engine/sets';
import { isValidSet } from '../engine/sets';
import { newId } from '../lib/id';

export function findCandidateSets(hand: Card[], minSize: number): CardSet[] {
  const candidates: CardSet[] = [];
  const ownerId = 'ai-tmp';

  // Groups: same rank, distinct suits
  const byRank = new Map<string, Card[]>();
  for (const c of hand) byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c]);
  for (const [, cards] of byRank) {
    if (cards.length >= minSize) {
      const nonAces = cards.filter((c) => c.rank !== 'A');
      if (nonAces.length > 0) {
        const groupCards: CardInSet[] = cards.map((c) => ({ card: c }));
        const tmp: CardSet = { id: newId('grp'), ownerId, kind: 'group', cards: groupCards };
        if (isValidSet(tmp, { minSize: minSize as 3 | 4 }).ok) {
          candidates.push(tmp);
        }
      }
    }
  }

  // Runs: same suit, consecutive ranks
  const bySuit = new Map<string, Card[]>();
  for (const c of hand) {
    if (c.rank !== 'A') bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c]);
  }

  const aces = hand.filter((c) => c.rank === 'A');

  for (const suit of SUITS) {
    const suitCards = bySuit.get(suit) ?? [];
    const indices = suitCards.map((c) => ({
      card: c,
      idx: rankIndex(c.rank as Exclude<Card['rank'], 'A'>),
    }));
    indices.sort((a, b) => a.idx - b.idx);

    // Find consecutive windows without aces
    for (let start = 0; start < indices.length; start++) {
      for (let end = start + minSize - 1; end < indices.length; end++) {
        const window = indices.slice(start, end + 1);
        const span = window[window.length - 1]!.idx - window[0]!.idx;
        if (span !== window.length - 1) continue; // not consecutive

        const cards: CardInSet[] = window.map((w) => ({ card: w.card }));
        const tmp: CardSet = { id: newId('run'), ownerId, kind: 'run', cards };
        if (isValidSet(tmp, { minSize: minSize as 3 | 4 }).ok) {
          candidates.push(tmp);
        }
      }
    }

    // Try runs with Ace filling a gap or edge
    if (aces.length > 0) {
      for (let start = 0; start < indices.length; start++) {
        for (let end = start + minSize - 2; end < indices.length; end++) {
          const window = indices.slice(start, end + 1);
          const span = window[window.length - 1]!.idx - window[0]!.idx;
          if (span > window.length) continue; // can't fill all gaps with one ace

          // Try inserting one ace to make consecutive
          const usedIndices = new Set(window.map((w) => w.idx));
          for (let aceIdx = Math.max(0, window[0]!.idx - 1); aceIdx <= Math.min(11, window[window.length - 1]!.idx + 1); aceIdx++) {
            if (usedIndices.has(aceIdx)) continue;
            const aceRank = RANK_ORDER[aceIdx];
            if (!aceRank) continue;

            const ace = aces[0]!;
            const withAce: CardInSet[] = [
              ...window.map((w) => ({ card: w.card })),
              { card: ace, aceRole: { rank: aceRank, suit: suit } },
            ];
            const tmp: CardSet = { id: newId('run-ace'), ownerId, kind: 'run', cards: withAce };
            if (isValidSet(tmp, { minSize: minSize as 3 | 4 }).ok) {
              candidates.push(tmp);
            }
          }
        }
      }
    }
  }

  // Deduplicate by card ID sets
  const seen = new Set<string>();
  return candidates.filter((s) => {
    const key = s.cards
      .map((c) => c.card.id)
      .sort()
      .join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pickBestNonOverlapping(candidates: CardSet[], minSize: number): CardSet[] {
  // Sort by card count descending (prefer larger sets)
  const sorted = [...candidates].sort((a, b) => b.cards.length - a.cards.length);
  const used = new Set<string>();
  const result: CardSet[] = [];

  for (const set of sorted) {
    const ids = set.cards.map((c) => c.card.id);
    if (ids.some((id) => used.has(id))) continue;
    if (set.cards.length < minSize) continue;
    result.push(set);
    ids.forEach((id) => used.add(id));
  }

  return result;
}
