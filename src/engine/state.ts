import { createDeck, deal, shuffle } from './deck';
import type { GameState, Player } from './types';
import { mulberry32 } from '../lib/rng';

export function createInitialState(
  playerNames: string[],
  seed: number,
): GameState {
  const rng = mulberry32(seed);
  const deck = shuffle(createDeck(), rng);

  const { hands, remaining } = deal(deck, playerNames.length);

  const [firstCard, ...drawPile] = remaining;
  if (!firstCard) throw new Error('Not enough cards to initialise');

  const players: Player[] = playerNames.map((name, i) => ({
    id: `player-${i}`,
    name,
    isAI: i > 0,
    hand: hands[i]!,
    hasOpened: false,
  }));

  const turnOrder = players.map((p) => p.id);

  return {
    players,
    turnOrder,
    currentPlayerIdx: 0,
    drawPile,
    discardPile: [firstCard],
    table: [],
    phase: 'awaitingDraw',
    rngSeed: seed,
  };
}

export function currentPlayer(state: GameState): Player {
  const id = state.turnOrder[state.currentPlayerIdx];
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error('Current player not found');
  return player;
}
