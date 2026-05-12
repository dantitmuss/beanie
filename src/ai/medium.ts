import type { Card, CardInSet, CardSet, GameState, PlayerId } from '../engine/types';
import { applyAction } from '../engine/actions';
import { findCandidateSets, pickBestNonOverlapping } from './findSets';
import { tryExtend, tryAceReplacement } from './tryExtend';
import { discardChoice } from './score';
import { newId } from '../lib/id';

export type AIAction =
  | { type: 'DRAW' }
  | { type: 'TAKE_DISCARD' }
  | { type: 'PLAY_SET'; ownerId: PlayerId; cards: CardInSet[] }
  | { type: 'DISCARD'; cardId: string };

export function computeAITurn(state: GameState, aiId: PlayerId): AIAction[] {
  const actions: AIAction[] = [];
  let current = state;

  // Step 1: Decide intake
  const intake = decideIntake(current, aiId);
  actions.push(intake);
  try {
    current = applyAction(current, intake);
  } catch {
    return actions;
  }

  // Step 2: Find and play sets
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 10) {
    improved = false;
    iterations++;

    const aiPlayer = current.players.find((p) => p.id === aiId)!;

    // Try ace replacement first (frees aces for new sets)
    for (const card of aiPlayer.hand) {
      const rep = tryAceReplacement(card, current.table);
      if (rep) {
        const playAction: AIAction = {
          type: 'PLAY_SET',
          ownerId: aiId,
          cards: rep.newCards,
        };
        try {
          // Ace replacement is a rearrange operation, not a PLAY_SET.
          // We skip it in PLAY_SET mode; handled in rearrange.
          void playAction;
        } catch {
          // ignore
        }
      }
    }

    const minSize = aiPlayer.hasOpened ? 3 : 4;
    const candidates = findCandidateSets(aiPlayer.hand, minSize);
    const toPlay = pickBestNonOverlapping(candidates, minSize);

    if (toPlay.length > 0) {
      for (const set of toPlay) {
        const playCards = set.cards;
        if (aiPlayer.hand.length === playCards.length) continue; // must keep 1 card to discard
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
          break; // re-evaluate hand after each play
        } catch {
          void ownedSet;
        }
      }
    }

    if (!improved) {
      // Try extending existing table sets
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
          // We can't dispatch PLAY_SET for extending (it adds to existing set via replace).
          // Instead try extending the target set cards combined with the hand card.
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
            // try next
          }
        }
      }
    }
  }

  // Step 4: Discard
  const hand = current.players.find((p) => p.id === aiId)!.hand;
  if (hand.length === 0) return actions;

  const toDiscard = discardChoice(hand);
  const discardAction: AIAction = { type: 'DISCARD', cardId: toDiscard.id };
  actions.push(discardAction);

  return actions;
}

function decideIntake(state: GameState, aiId: PlayerId): AIAction {
  const aiPlayer = state.players.find((p) => p.id === aiId)!;
  const hand = aiPlayer.hand;
  const discard = state.discardPile;

  if (discard.length === 0) return { type: 'DRAW' };

  // Check if the discard pile contains any card that completes a set
  for (const pileCard of discard) {
    const testHand = [...hand, pileCard];
    const minSize = aiPlayer.hasOpened ? 3 : 4;
    const candidates = findCandidateSets(testHand, minSize);
    if (candidates.length > 0) {
      // Only take if pile size is reasonable
      if (discard.length <= 6 || !aiPlayer.hasOpened) {
        return { type: 'TAKE_DISCARD' };
      }
    }
  }

  // Check opening: pile card completes a 4-card set
  if (!aiPlayer.hasOpened) {
    for (const pileCard of discard) {
      const testHand = [...hand, pileCard];
      const candidates = findCandidateSets(testHand, 4);
      if (candidates.length > 0) return { type: 'TAKE_DISCARD' };
    }
  }

  return { type: 'DRAW' };
}

function guessKind(cards: Card[]): CardSet['kind'] {
  const nonAces = cards.filter((c) => c.rank !== 'A');
  const suits = new Set(nonAces.map((c) => c.suit));
  return suits.size === 1 ? 'run' : 'group';
}

// Silence unused warning
void guessKind;
