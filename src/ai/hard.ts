import type { Card, CardSet, GameState, PlayerId } from '../engine/types';
import { applyAction } from '../engine/actions';
import { rankIndex } from '../engine/sets';
import { findCandidateSets, pickBestNonOverlapping } from './findSets';
import { tryExtend } from './tryExtend';
import { discardChoice } from './score';
import { mctsDiscardChoice } from './mcts';
import { applyRearrangePatterns } from './rearrangePatterns';
import { newId } from '../lib/id';
import type { AIAction, AIPolicy, AIWeights } from './types';

export function makeHardPolicy(weights: AIWeights): AIPolicy {
  return {
    computeTurn(state: GameState, aiId: PlayerId): AIAction[] {
      return computeHardTurn(state, aiId, weights);
    },
  };
}

function computeHardTurn(state: GameState, aiId: PlayerId, weights: AIWeights): AIAction[] {
  const actions: AIAction[] = [];
  let current = state;

  // Step 1: aggressive intake
  const intake = decideIntakeHard(current, aiId, weights);
  actions.push(intake);
  try {
    current = applyAction(current, intake);
  } catch {
    return actions;
  }

  // Step 2: rearrange (ace replacement + bridge merge) if player has opened
  const playerAfterIntake = current.players.find((p) => p.id === aiId)!;
  if (
    weights.rearrangeMaxDepth > 0 &&
    weights.attemptAceReplacement &&
    playerAfterIntake.hasOpened
  ) {
    const rearrange = applyRearrangePatterns(playerAfterIntake.hand, current.table);
    if (rearrange) {
      // Apply both actions speculatively; only commit both if both succeed.
      const stateBeforeRearrange = current;
      try {
        const startAction: AIAction = { type: 'START_REARRANGE' };
        const afterStart = applyAction(current, startAction);

        const commitAction: AIAction = {
          type: 'COMMIT_REARRANGE',
          nextTable: rearrange.nextTable,
          nextHand: rearrange.nextHand,
        };
        const afterCommit = applyAction(afterStart, commitAction);

        current = afterCommit;
        actions.push(startAction);
        actions.push(commitAction);
      } catch {
        current = stateBeforeRearrange; // restore — leave actions unchanged
      }
    }
  }

  // Step 3: play best non-overlapping sets
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 10) {
    improved = false;
    iterations++;

    const aiPlayer = current.players.find((p) => p.id === aiId)!;
    const minSize = aiPlayer.hasOpened ? 3 : 4;
    const candidates = findCandidateSets(aiPlayer.hand, minSize);
    const toPlay = pickBestNonOverlapping(candidates, minSize);

    if (toPlay.length > 0) {
      for (const set of toPlay) {
        const playCards = set.cards;
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

    if (!improved) {
      const refreshedPlayer = current.players.find((p) => p.id === aiId)!;
      for (const card of refreshedPlayer.hand) {
        const ext = tryExtend(card, current.table);
        if (ext && refreshedPlayer.hand.length > 1) {
          const extSet = current.table.find((s) => s.id === ext.setId)!;
          const combined = [...extSet.cards.map((c) => ({ ...c })), { card }];
          const combinedAction: AIAction = {
            type: 'PLAY_SET',
            ownerId: aiId,
            cards: combined,
          };
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

  // Step 4: discard — use MCTS if rollouts configured, else standard
  const hand = current.players.find((p) => p.id === aiId)!.hand;
  if (hand.length === 0) return actions;

  const toDiscard =
    weights.mctsRollouts > 0
      ? mctsDiscardChoice(hand, current, aiId, weights)
      : discardChoice(hand, weights);

  actions.push({ type: 'DISCARD', cardId: toDiscard.id });
  return actions;
}

function decideIntakeHard(state: GameState, aiId: PlayerId, weights: AIWeights): AIAction {
  const aiPlayer = state.players.find((p) => p.id === aiId)!;
  const hand = aiPlayer.hand;
  const discard = state.discardPile;

  if (discard.length === 0) return { type: 'DRAW' };

  const minSize = aiPlayer.hasOpened ? 3 : 4;

  for (const pileCard of discard) {
    const testHand = [...hand, pileCard];

    // Complete set: take if pile is small enough (or not yet opened)
    const complete = findCandidateSets(testHand, minSize);
    if (complete.length > 0) {
      if (discard.length <= weights.takeDiscardPileSizeCap || !aiPlayer.hasOpened) {
        return { type: 'TAKE_DISCARD' };
      }
    }

    // Near-set: pile card is useful to existing hand cards (more aggressive)
    if (discard.length <= weights.takeDiscardPileSizeCap && pileCardIsUseful(pileCard, hand)) {
      return { type: 'TAKE_DISCARD' };
    }
  }

  return { type: 'DRAW' };
}

// A pile card is "useful" if it matches a hand card by rank (near-group)
// or is close in rank and same suit (near-run), making future sets more likely.
function pileCardIsUseful(pileCard: Card, hand: Card[]): boolean {
  if (hand.some((c) => c.rank === pileCard.rank)) return true;

  if (pileCard.rank !== 'A') {
    const pileIdx = rankIndex(pileCard.rank as Exclude<Card['rank'], 'A'>);
    return hand.some((c) => {
      if (c.rank === 'A' || c.suit !== pileCard.suit) return false;
      const cIdx = rankIndex(c.rank as Exclude<Card['rank'], 'A'>);
      return Math.abs(cIdx - pileIdx) <= 2;
    });
  }

  return false;
}
