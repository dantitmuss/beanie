import type { Action } from '../src/engine/actions';
import { applyAction } from '../src/engine/actions';
import { createInitialState, currentPlayer } from '../src/engine/state';
import type { GameState } from '../src/engine/types';
import type { ErrorCode, LobbyPlayer, RoomPhase } from './messages';
import { MAX_PLAYERS } from './messages';

export { MAX_PLAYERS };
export const RECONNECT_WINDOW_MS = 60_000;
export const MAX_NAME_LENGTH = 16;

export interface Seat {
  id: string; // public seat id, safe to broadcast
  sessionId: string; // reconnect token, never broadcast
  name: string;
  connected: boolean;
  engineId: string | null; // 'player-N' while a game is live
}

export interface RoomError {
  ok: false;
  code: ErrorCode;
  message: string;
}

export type HelloResult = { ok: true; seat: Seat; resumed: boolean } | RoomError;

function err(code: ErrorCode, message: string): RoomError {
  return { ok: false, code, message };
}

/**
 * Pure per-room state machine: lobby | playing | ended. No transport concerns —
 * the PartyKit server in server.ts adapts connections onto this.
 * Host is always seats[0], so host promotion on leave is automatic.
 */
export class BeanieRoom {
  phase: RoomPhase = 'lobby';
  seats: Seat[] = [];
  game: GameState | null = null;
  private seatCounter = 0;

  get hostId(): string | null {
    return this.seats[0]?.id ?? null;
  }

  lobbyPlayers(): LobbyPlayer[] {
    return this.seats.map((s) => ({
      id: s.id,
      name: s.name,
      connected: s.connected,
      engineId: s.engineId,
    }));
  }

  seatForSession(sessionId: string): Seat | null {
    return this.seats.find((s) => s.sessionId === sessionId) ?? null;
  }

  hello(sessionId: string, displayName: string, intent: 'create' | 'join'): HelloResult {
    const existing = this.seatForSession(sessionId);
    if (existing) {
      existing.connected = true;
      return { ok: true, seat: existing, resumed: true };
    }

    if (intent === 'create') {
      if (this.seats.length > 0) {
        return err('ROOM_TAKEN', 'That room code is already in use');
      }
    } else {
      if (this.seats.length === 0) return err('NOT_FOUND', 'Room not found');
      if (this.phase !== 'lobby') return err('STARTED', 'That game has already started');
      if (this.seats.length >= MAX_PLAYERS) return err('FULL', 'Room is full');
    }

    const name = displayName.trim().slice(0, MAX_NAME_LENGTH) || 'Player';
    const seat: Seat = {
      id: `seat-${this.seatCounter++}`,
      sessionId,
      name,
      connected: true,
      engineId: null,
    };
    this.seats.push(seat);
    return { ok: true, seat, resumed: false };
  }

  start(bySeatId: string, seed: number): { ok: true } | RoomError {
    if (this.phase !== 'lobby') return err('INVALID', 'Game already started');
    if (bySeatId !== this.hostId) return err('INVALID', 'Only the host can start the game');
    if (this.seats.length < 2) return err('INVALID', 'Need at least 2 players to start');

    const state = createInitialState(this.seats.map((s) => s.name), seed);
    this.game = {
      ...state,
      // createInitialState marks every non-first player as AI; mp seats are all human
      players: state.players.map((p) => ({ ...p, isAI: false })),
    };
    this.seats.forEach((s, i) => {
      s.engineId = `player-${i}`;
    });
    this.phase = 'playing';
    return { ok: true };
  }

  applyGameAction(bySeatId: string, action: Action): { ok: true; state: GameState } | RoomError {
    if (this.phase !== 'playing' || !this.game) return err('INVALID', 'No game in progress');

    const seat = this.seats.find((s) => s.id === bySeatId);
    if (!seat?.engineId) return err('INVALID', 'You are not seated in this game');
    if (currentPlayer(this.game).id !== seat.engineId) return err('INVALID', 'Not your turn');
    if (action.type === 'AI_TURN') return err('INVALID', 'Unsupported action');

    try {
      this.game = applyAction(this.game, action);
    } catch (e) {
      return err('INVALID', e instanceof Error ? e.message : 'Invalid move');
    }

    if (this.game.phase === 'gameOver') this.phase = 'ended';
    return { ok: true, state: this.game };
  }

  rematch(bySeatId: string): { ok: true } | RoomError {
    if (this.phase !== 'ended') return err('INVALID', 'Game is still in progress');
    if (bySeatId !== this.hostId) return err('INVALID', 'Only the host can start a rematch');

    this.game = null;
    this.phase = 'lobby';
    this.seats.forEach((s) => {
      s.engineId = null;
    });
    return { ok: true };
  }

  markDisconnected(sessionId: string): Seat | null {
    const seat = this.seatForSession(sessionId);
    if (seat) seat.connected = false;
    return seat;
  }

  /**
   * Permanently remove a seat (explicit LEAVE or expired reconnect window).
   * If a game is live, the whole game ends — V5 has no AI takeover or
   * mid-game seat removal, so the room resets and clients are told to leave.
   */
  removeSeat(sessionId: string): { removed: Seat | null; endedGame: boolean } {
    const idx = this.seats.findIndex((s) => s.sessionId === sessionId);
    if (idx === -1) return { removed: null, endedGame: false };

    const removed = this.seats[idx]!;
    this.seats.splice(idx, 1);

    if (this.phase === 'playing') {
      this.phase = 'ended';
      this.game = null;
      return { removed, endedGame: true };
    }
    return { removed, endedGame: false };
  }
}
