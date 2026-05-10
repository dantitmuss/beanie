import type { RNG } from '../lib/rng';
import type { Card, Rank, Suit } from './types';

const SUITS: Suit[] = ['♣', '♦', '♥', '♠'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${rank}${suit}`, rank, suit });
    }
  }
  return cards;
}

export function shuffle(deck: Card[], rng: RNG): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function deal(
  deck: Card[],
  numPlayers: number,
  perPlayer = 9,
): { hands: Card[][]; remaining: Card[] } {
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  let idx = 0;
  for (let p = 0; p < numPlayers; p++) {
    for (let c = 0; c < perPlayer; c++) {
      hands[p]!.push(deck[idx++]!);
    }
  }
  return { hands, remaining: deck.slice(idx) };
}
