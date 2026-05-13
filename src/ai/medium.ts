import type { CardSet, GameState, PlayerId } from '../engine/types';
import { applyAction } from '../engine/actions';
import { findCandidateSets, pickBestNonOverlapping } from './findSets';
import { tryExtend, tryAceReplacement } from './tryExtend';
import { discardChoice } from './score';
import { newId } from '../lib/id';
import type { AIAction, AIPolicy, AIWeights } from './types';
import mediumData from './weights/medium.json';
import { validateWeights } from './weights/schema';

export function makeMediumPolicy(weights: AIWeights): AIPolicy {
  return {
    computeTurn(state: GameState, aiId: PlayerId): AIAction[] {
      return computeAITurnWithWeights(state, aiId, weights);
    },
  };
}

function computeAITurnWithWeights(
  state: GameState,
  aiId: PlayerId,
  weights: AIWeights,
): AIAction[] {
  const actions: AIAction[] = [];
  let current = state;

  const intake = decideIntake(current, aiId, weights);
  actions.push(intake);
  try {
    current = applyAction(current, intake);
  } catch {
    return actions;
  }

  let improved = true;
  let iterations = 0;
  while (improved && iterations < 10) {
    improved = false;
    iterations++;

    const aiPlayer = current.players.find((p) => p.id === aiId)!;

    // Ace replacement stub — currently a no-op; wired in Phase 2 (Hard)
    for (const card of aiPlayer.hand) {
      const rep = tryAceReplacement(card, current.table);
      if (rep) {
        const playAction: AIAction = {
          type: 'PLAY_SET',
          ownerId: aiId,
          cards: rep.newCards,
        };
        void playAction;
      }
    }

    const minSize = aiPlayer.hasOpened ? 3 : 4;
    const candidates = findCandidateSets(aiPlayer.hand, minSize);
    const toPlay = pickBestNonOverlapping(candidates, minSize);

    if (toPlay.length > 0) {
      for (const set of toPlay) {
        const playCards = set.cards;
        // Guard: must keep at least 1 card in hand to discard
        if (aiPlayer.hand.length === playCards.length) continue;
        const ownedSet: CardSet = { ...set, id: newId('ai-set'), ownerId: aiId };
        const playAction = {
          type: 'PLAY_SET' as const,
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

    if (!improved) {
      const refreshedPlayer = current.players.find((p) => p.id === aiId)!;
      for (const card of refreshedPlayer.hand) {
        const ext = tryExtend(card, current.table);
        if (ext && refreshedPlayer.hand.length > 1) {
          const extSet = current.table.find((s) => s.id === ext.setId)!;
          const playAction = {
            type: 'PLAY_SET' as const,
            ownerId: extSet.ownerId,
            cards: ext.newCards,
          };
          const combined = [...extSet.cards.map((c) => ({ ...c })), { card }];
          const combinedAction = {
            type: 'PLAY_SET' as const,
            ownerId: aiId,
            cards: combined,
          };
          void playAction;
          try {
            current = applyAction(current, combinedAction);
            actions.push(combinedAction);
            improved = true;
            break;
          } catch {
            // try next card
          }
        }
      }
    }
  }

  // Guard: don't discard if hand is already empty (e.g. win condition reached)
  const hand = current.players.find((p) => p.id === aiId)!.hand;
  if (hand.length === 0) return actions;

  const toDiscard = discardChoice(hand, weights);
  const discardAction: AIAction = { type: 'DISCARD', cardId: toDiscard.id };
  actions.push(discardAction);

  return actions;
}

function decideIntake(state: GameState, aiId: PlayerId, weights: AIWeights): AIAction {
  const aiPlayer = state.players.find((p) => p.id === aiId)!;
  const hand = aiPlayer.hand;
  const discard = state.discardPile;

  if (discard.length === 0) return { type: 'DRAW' };

  for (const pileCard of discard) {
    const testHand = [...hand, pileCard];
    const minSize = aiPlayer.hasOpened ? 3 : 4;
    const candidates = findCandidateSets(testHand, minSize);
    if (candidates.length > 0) {
      if (discard.length <= weights.takeDiscardPileSizeCap || !aiPlayer.hasOpened) {
        return { type: 'TAKE_DISCARD' };
      }
    }
  }

  if (!aiPlayer.hasOpened) {
    for (const pileCard of discard) {
      const testHand = [...hand, pileCard];
      const candidates = findCandidateSets(testHand, 4);
      if (candidates.length > 0) return { type: 'TAKE_DISCARD' };
    }
  }

  return { type: 'DRAW' };
}

// Backward-compat shim used by gameStore until Phase 4 difficulty plumbing
const _mediumWeights = validateWeights(mediumData, 'medium');

export function computeAITurn(state: GameState, aiId: PlayerId): AIAction[] {
  return makeMediumPolicy(_mediumWeights).computeTurn(state, aiId);
}
