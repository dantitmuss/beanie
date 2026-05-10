import type { CardInSet, CardSet, GameState, PlayerId } from './types';
import { isValidSet } from './sets';
import { canCommitRearrange } from './rearrange';
import { mulberry32 } from '../lib/rng';
import { shuffle } from './deck';
import { newId } from '../lib/id';
import { currentPlayer } from './state';

export type Action =
  | { type: 'DRAW' }
  | { type: 'TAKE_DISCARD' }
  | { type: 'PLAY_SET'; ownerId: PlayerId; cards: CardInSet[] }
  | { type: 'START_REARRANGE' }
  | { type: 'COMMIT_REARRANGE'; nextTable: CardSet[]; nextHand: CardInSet[] }
  | { type: 'CANCEL_REARRANGE' }
  | { type: 'DISCARD'; cardId: string }
  | { type: 'AI_TURN' };

export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'DRAW':
      return applyDraw(state);
    case 'TAKE_DISCARD':
      return applyTakeDiscard(state);
    case 'PLAY_SET':
      return applyPlaySet(state, action.ownerId, action.cards);
    case 'START_REARRANGE':
      return applyStartRearrange(state);
    case 'COMMIT_REARRANGE':
      return applyCommitRearrange(state, action.nextTable, action.nextHand);
    case 'CANCEL_REARRANGE':
      return applyCancelRearrange(state);
    case 'DISCARD':
      return applyDiscard(state, action.cardId);
    case 'AI_TURN':
      return state;
  }
}

function applyDraw(state: GameState): GameState {
  if (state.phase !== 'awaitingDraw') throw new Error('Cannot draw outside awaitingDraw phase');
  if (state.drawPile.length === 0) throw new Error('Draw pile is empty');

  const [drawn, ...drawPile] = state.drawPile;
  const player = currentPlayer(state);

  return {
    ...state,
    drawPile,
    players: state.players.map((p) =>
      p.id === player.id ? { ...p, hand: [...p.hand, drawn!] } : p,
    ),
    phase: 'inTurn',
  };
}

function applyTakeDiscard(state: GameState): GameState {
  if (state.phase !== 'awaitingDraw') throw new Error('Cannot take discard outside awaitingDraw phase');
  if (state.discardPile.length === 0) throw new Error('Discard pile is empty');

  const player = currentPlayer(state);

  return {
    ...state,
    discardPile: [],
    players: state.players.map((p) =>
      p.id === player.id
        ? { ...p, hand: [...p.hand, ...state.discardPile] }
        : p,
    ),
    phase: 'inTurn',
  };
}

function applyPlaySet(state: GameState, ownerId: PlayerId, cards: CardInSet[]): GameState {
  if (state.phase !== 'inTurn') throw new Error('Can only play sets during inTurn phase');

  const player = currentPlayer(state);

  if (ownerId !== player.id) {
    if (!player.hasOpened) throw new Error('Must open before playing to other areas');
  }

  const tmpSet: CardSet = {
    id: 'tmp',
    ownerId,
    kind: inferSetKind(cards),
    cards,
  };

  const minSize = player.hasOpened ? 3 : 4;
  const validation = isValidSet(tmpSet, { minSize });
  if (!validation.ok) throw new Error(`Invalid set: ${validation.reason}`);

  const cardIds = new Set(cards.map((c) => c.card.id));
  const playerHandIds = new Set(player.hand.map((c) => c.id));
  for (const id of cardIds) {
    if (!playerHandIds.has(id)) throw new Error(`Card ${id} is not in your hand`);
  }

  const newSet: CardSet = {
    id: newId('set'),
    ownerId,
    kind: tmpSet.kind,
    cards,
  };

  const nextHand = player.hand.filter((c) => !cardIds.has(c.id));
  const nextHasOpened = player.hasOpened || (!player.hasOpened && ownerId === player.id);

  return {
    ...state,
    table: [...state.table, newSet],
    players: state.players.map((p) =>
      p.id === player.id
        ? { ...p, hand: nextHand, hasOpened: nextHasOpened }
        : p,
    ),
  };
}

function inferSetKind(cards: CardInSet[]): CardSet['kind'] {
  const nonAces = cards.filter((c) => c.card.rank !== 'A');
  if (nonAces.length === 0) return 'group';
  const suits = new Set(nonAces.map((c) => c.card.suit));
  return suits.size === 1 ? 'run' : 'group';
}

function applyStartRearrange(state: GameState): GameState {
  if (state.phase !== 'inTurn') throw new Error('Can only start rearrange during inTurn phase');
  const player = currentPlayer(state);
  if (!player.hasOpened) throw new Error('Must open before rearranging');

  return {
    ...state,
    phase: 'rearranging',
    rearrangeSnapshot: state,
  };
}

function applyCommitRearrange(
  state: GameState,
  nextTable: CardSet[],
  nextHandCards: CardInSet[],
): GameState {
  if (state.phase !== 'rearranging') throw new Error('Not in rearranging phase');
  if (!state.rearrangeSnapshot) throw new Error('No rearrange snapshot');

  const player = currentPlayer(state);
  const nextHand = nextHandCards.map((c) => c.card);

  const nextState: GameState = {
    ...state,
    table: nextTable,
    players: state.players.map((p) =>
      p.id === player.id ? { ...p, hand: nextHand } : p,
    ),
  };

  const result = canCommitRearrange(state.rearrangeSnapshot, nextState, player.id);
  if (!result.ok) throw new Error(`Cannot commit: ${result.errors.join('; ')}`);

  return {
    ...nextState,
    phase: 'inTurn',
    rearrangeSnapshot: undefined,
  };
}

function applyCancelRearrange(state: GameState): GameState {
  if (state.phase !== 'rearranging') throw new Error('Not in rearranging phase');
  if (!state.rearrangeSnapshot) throw new Error('No rearrange snapshot');
  return state.rearrangeSnapshot;
}

function applyDiscard(state: GameState, cardId: string): GameState {
  if (state.phase !== 'inTurn') throw new Error('Can only discard during inTurn phase');

  const player = currentPlayer(state);
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} is not in your hand`);

  const nextHand = player.hand.filter((c) => c.id !== cardId);
  const newDiscardTop = card;

  if (nextHand.length === 0 && player.hasOpened) {
    return {
      ...state,
      discardPile: [newDiscardTop, ...state.discardPile],
      players: state.players.map((p) =>
        p.id === player.id ? { ...p, hand: nextHand } : p,
      ),
      phase: 'gameOver',
      winner: player.id,
    };
  }

  const nextIdx = (state.currentPlayerIdx + 1) % state.players.length;

  let nextDrawPile = state.drawPile;
  let nextDiscardPile = [newDiscardTop, ...state.discardPile];

  if (nextDrawPile.length === 0 && nextDiscardPile.length > 1) {
    const [topCard, ...rest] = nextDiscardPile;
    const rng = mulberry32(state.rngSeed + 1);
    nextDrawPile = shuffle(rest, rng);
    nextDiscardPile = [topCard!];
  }

  return {
    ...state,
    drawPile: nextDrawPile,
    discardPile: nextDiscardPile,
    players: state.players.map((p) =>
      p.id === player.id ? { ...p, hand: nextHand } : p,
    ),
    currentPlayerIdx: nextIdx,
    phase: 'awaitingDraw',
    rngSeed: state.rngSeed + 1,
  };
}
