import type { Action } from '../src/engine/actions';
import type { Card, GameState, Player } from '../src/engine/types';

export const MAX_PLAYERS = 4;

export type RoomPhase = 'lobby' | 'playing' | 'ended';

export interface LobbyPlayer {
  id: string; // public seat id, stable for the life of the room
  name: string;
  connected: boolean;
  engineId: string | null; // 'player-N' once a game has started
}

export type ClientMessage =
  | { type: 'HELLO'; sessionId: string; displayName: string; intent: 'create' | 'join' }
  | { type: 'START_GAME' }
  | { type: 'GAME_ACTION'; action: Action }
  | { type: 'REQUEST_REMATCH' }
  | { type: 'LEAVE' };

/** A card whose face is hidden from this viewer. Same id, no rank/suit. */
export interface HiddenCard {
  id: string;
  hidden: true;
}

export type RedactedCard = Card | HiddenCard;

export type RedactedPlayer = Omit<Player, 'hand'> & { hand: RedactedCard[] };

export type RedactedGameState = Omit<GameState, 'players' | 'drawPile' | 'rearrangeSnapshot'> & {
  players: RedactedPlayer[];
  drawPile: HiddenCard[];
  rearrangeSnapshot?: RedactedGameState;
};

export type ErrorCode = 'ROOM_TAKEN' | 'NOT_FOUND' | 'FULL' | 'STARTED' | 'INVALID';

export type ServerMessage =
  | {
      type: 'LOBBY_STATE';
      code: string;
      selfId: string;
      hostId: string;
      phase: RoomPhase;
      players: LobbyPlayer[];
    }
  | { type: 'GAME_STATE'; state: RedactedGameState }
  | { type: 'ERROR'; code: ErrorCode; message: string }
  | { type: 'ROOM_CLOSED'; reason: string };
