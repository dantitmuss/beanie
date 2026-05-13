import type { AIWeights } from '../types';

const REQUIRED_KEYS: Array<keyof AIWeights> = [
  'takeDiscardCompletesSetBonus',
  'takeDiscardOpeningBonus',
  'takeDiscardPileSizeCap',
  'nearSetBonus',
  'sameRankBonus',
  'sameSuitNearRankBonus',
  'aceBonus',
  'staleDecay',
  'rearrangeMaxDepth',
  'attemptAceReplacement',
  'mctsRollouts',
  'mctsRolloutDepth',
];

export function validateWeights(data: unknown, name: string): AIWeights {
  if (typeof data !== 'object' || data === null) {
    throw new Error(`${name}: weights must be an object`);
  }
  const w = data as Record<string, unknown>;
  for (const key of REQUIRED_KEYS) {
    if (!(key in w)) throw new Error(`${name}: missing key "${key}"`);
  }
  return data as AIWeights;
}
