export type Suit = '♣' | '♦' | '♥' | '♠';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export interface AceRole {
  rank: Exclude<Rank, 'A'>;
  suit: Suit;
}

export interface CardInSet {
  card: Card;
  aceRole?: AceRole;
}

export type SetKind = 'group' | 'run';

export interface CardSet {
  id: string;
  ownerId: PlayerId;
  kind: SetKind;
  cards: CardInSet[];
}

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  isAI: boolean;
  hand: Card[];
  hasOpened: boolean;
}

export interface GameState {
  players: Player[];
  turnOrder: PlayerId[];
  currentPlayerIdx: number;
  drawPile: Card[];
  discardPile: Card[];
  table: CardSet[];
  phase: 'awaitingDraw' | 'inTurn' | 'rearranging' | 'gameOver';
  rearrangeSnapshot?: GameState;
  winner?: PlayerId;
  rngSeed: number;
}
