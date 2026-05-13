import type { CardInSet, GameState, PlayerId } from '../engine/types';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface AIWeights {
  // Intake
  takeDiscardCompletesSetBonus: number;
  takeDiscardOpeningBonus: number;
  takeDiscardPileSizeCap: number;
  // Per-card keep value
  nearSetBonus: number;
  sameRankBonus: number;
  sameSuitNearRankBonus: number;
  aceBonus: number;
  staleDecay: number;
  // Rearrange aggressiveness
  rearrangeMaxDepth: number;
  attemptAceReplacement: boolean;
  // Hard-only MCTS
  mctsRollouts: number;
  mctsRolloutDepth: number;
}

export type AIAction =
  | { type: 'DRAW' }
  | { type: 'TAKE_DISCARD' }
  | { type: 'PLAY_SET'; ownerId: PlayerId; cards: CardInSet[] }
  | { type: 'START_REARRANGE' }
  | { type: 'COMMIT_REARRANGE'; nextTable: import('../engine/types').CardSet[]; nextHand: CardInSet[] }
  | { type: 'DISCARD'; cardId: string };

export interface AIPolicy {
  computeTurn(state: GameState, aiId: PlayerId): AIAction[];
}
