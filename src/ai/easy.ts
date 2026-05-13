import type { Card, CardSet, GameState, PlayerId } from '../engine/types';
import { applyAction } from '../engine/actions';
import { findCandidateSets } from './findSets';
import { cardKeepValue } from './score';
import { newId } from '../lib/id';
import type { AIAction, AIPolicy, AIWeights } from './types';

export function makeEasyPolicy(weights: AIWeights): AIPolicy {
  return {
    computeTurn(state: GameState, aiId: PlayerId): AIAction[] {
      return computeEasyTurn(state, aiId, weights);
    },
  };
}

function computeEasyTurn(state: GameState, aiId: PlayerId, weights: AIWeights): AIAction[] {
  const actions: AIAction[] = [];
  let current = state;

  // Always draw, never take discard
  const intake: AIAction = { type: 'DRAW' };
  actions.push(intake);
  try {
    current = applyAction(current, intake);
  } catch {
    return actions;
  }

  // Play first valid set found (not the best one — easy is naive)
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 10) {
    improved = false;
    iterations++;

    const aiPlayer = current.players.find((p) => p.id === aiId)!;
    const minSize = aiPlayer.hasOpened ? 3 : 4;
    const candidates = findCandidateSets(aiPlayer.hand, minSize);

    for (const set of candidates) {
      const playCards = set.cards;
      // Guard: must keep at least 1 card in hand to discard
      if (aiPlayer.hand.length === playCards.length) continue;
      const ownedSet: CardSet = { ...set, id: newId('ai-set'), ownerId: aiId };
      const playAction: AIAction = {
        type: 'PLAY_SET',
        ownerId: aiId,
        cards: playCards,
      };
      try {
        current = applyAction(current, playAction);
        actions.push(playAction);
        improved = true;
        break;
      } catch {
        void ownedSet;
      }
    }
  }

  const hand = current.players.find((p) => p.id === aiId)!.hand;
  if (hand.length === 0) return actions;

  const toDiscard = easyDiscardChoice(hand, weights);
  actions.push({ type: 'DISCARD', cardId: toDiscard.id });

  return actions;
}

// Discard a randomly chosen card from the bottom-scoring half of the hand.
// Avoids catastrophic discards (e.g. throwing away an opening set piece)
// while still being worse than Medium's deterministic worst-card discard.
function easyDiscardChoice(hand: Card[], weights: AIWeights): Card {
  const scored = hand.map((c) => ({ card: c, score: cardKeepValue(c, hand, weights) }));
  scored.sort((a, b) => a.score - b.score);

  const halfLen = Math.max(1, Math.floor(scored.length / 2));
  const bottomHalf = scored.slice(0, halfLen);
  const idx = Math.floor(Math.random() * bottomHalf.length);
  return bottomHalf[idx]!.card;
}
