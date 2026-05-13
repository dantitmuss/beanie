import type { Card } from '../engine/types';
import type { AIWeights } from './types';
import { rankIndex } from '../engine/sets';

export function cardKeepValue(card: Card, hand: Card[], weights: AIWeights): number {
  if (card.rank === 'A') {
    return weights.aceBonus;
  }

  let score = 0;

  const sameRank = hand.filter((c) => c.id !== card.id && c.rank === card.rank).length;
  score += sameRank * weights.sameRankBonus;

  const cardIdx = rankIndex(card.rank as Exclude<Card['rank'], 'A'>);
  const nearSameSuit = hand.filter((c) => {
    if (c.id === card.id || c.rank === 'A') return false;
    if (c.suit !== card.suit) return false;
    const cIdx = rankIndex(c.rank as Exclude<Card['rank'], 'A'>);
    return Math.abs(cIdx - cardIdx) <= 2;
  }).length;
  score += nearSameSuit * weights.sameSuitNearRankBonus;

  return score;
}

export function discardChoice(hand: Card[], weights: AIWeights): Card {
  let worst = hand[0]!;
  let worstScore = Infinity;
  for (const card of hand) {
    const s = cardKeepValue(card, hand, weights);
    if (s < worstScore) {
      worstScore = s;
      worst = card;
    }
  }
  return worst;
}
