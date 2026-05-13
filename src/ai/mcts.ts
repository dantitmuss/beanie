import type { Card, GameState, PlayerId } from '../engine/types';
import type { AIWeights } from './types';
import { cardKeepValue, discardChoice } from './score';

// Single-ply rollout discard: for each candidate discard, simulate mctsRollouts
// random draws and score the resulting hand. Pick the discard that leaves the
// best expected hand quality.
export function mctsDiscardChoice(
  hand: Card[],
  state: GameState,
  _aiId: PlayerId,
  weights: AIWeights,
): Card {
  if (weights.mctsRollouts === 0 || hand.length === 0) {
    return discardChoice(hand, weights);
  }

  // Unknown cards = current draw pile (best approximation available)
  const pool = state.drawPile;

  let bestCard = hand[0]!;
  let bestScore = -Infinity;

  for (const candidate of hand) {
    const reducedHand = hand.filter((c) => c.id !== candidate.id);
    let total = 0;

    for (let r = 0; r < weights.mctsRollouts; r++) {
      let simHand: Card[];

      if (pool.length > 0) {
        // Sample a random card from the draw pile
        const drawIdx = Math.floor(Math.random() * pool.length);
        const drawn = pool[drawIdx]!;
        simHand = [...reducedHand, drawn];
      } else {
        simHand = reducedHand;
      }

      total += simHand.reduce(
        (sum, c) => sum + cardKeepValue(c, simHand, weights),
        0,
      );
    }

    const avg = total / weights.mctsRollouts;
    if (avg > bestScore) {
      bestScore = avg;
      bestCard = candidate;
    }
  }

  return bestCard;
}
