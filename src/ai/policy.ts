import type { AIPolicy, AIWeights, Difficulty } from './types';
import { makeEasyPolicy } from './easy';
import { makeMediumPolicy } from './medium';
import { makeHardPolicy } from './hard';

export function makePolicy(difficulty: Difficulty, weights: AIWeights): AIPolicy {
  switch (difficulty) {
    case 'easy':
      return makeEasyPolicy(weights);
    case 'medium':
      return makeMediumPolicy(weights);
    case 'hard':
      return makeHardPolicy(weights);
  }
}
