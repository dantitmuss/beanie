import { describe, expect, it } from 'vitest';
import { BeanieRoom, MAX_PLAYERS } from '../room-state';
import { currentPlayer } from '../../src/engine/state';

function roomWithPlayers(count: number): BeanieRoom {
  const room = new BeanieRoom();
  for (let i = 0; i < count; i++) {
    const result = room.hello(`session-${i}`, `Player ${i}`, i === 0 ? 'create' : 'join');
    expect(result.ok).toBe(true);
  }
  return room;
}

describe('lobby join/leave', () => {
  it('lets a creator open a room and others join', () => {
    const room = roomWithPlayers(3);
    expect(room.phase).toBe('lobby');
    expect(room.lobbyPlayers()).toHaveLength(3);
    expect(room.hostId).toBe(room.seats[0]!.id);
  });

  it('rejects create on an occupied room code', () => {
    const room = roomWithPlayers(1);
    const result = room.hello('session-x', 'Late Creator', 'create');
    expect(result).toMatchObject({ ok: false, code: 'ROOM_TAKEN' });
  });

  it('rejects join on an empty room', () => {
    const room = new BeanieRoom();
    const result = room.hello('session-x', 'Joiner', 'join');
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('enforces the max player count', () => {
    const room = roomWithPlayers(MAX_PLAYERS);
    const result = room.hello('session-extra', 'Fifth', 'join');
    expect(result).toMatchObject({ ok: false, code: 'FULL' });
  });

  it('rejects new joins once the game has started', () => {
    const room = roomWithPlayers(2);
    room.start(room.hostId!, 42);
    const result = room.hello('session-late', 'Late', 'join');
    expect(result).toMatchObject({ ok: false, code: 'STARTED' });
  });

  it('resumes an existing seat by sessionId regardless of phase', () => {
    const room = roomWithPlayers(2);
    room.start(room.hostId!, 42);
    room.markDisconnected('session-1');
    expect(room.seats[1]!.connected).toBe(false);

    const result = room.hello('session-1', 'Player 1', 'join');
    expect(result).toMatchObject({ ok: true, resumed: true });
    expect(room.seats[1]!.connected).toBe(true);
    expect(room.lobbyPlayers()).toHaveLength(2);
  });

  it('promotes the next seat to host when the host leaves the lobby', () => {
    const room = roomWithPlayers(3);
    const secondSeatId = room.seats[1]!.id;
    const { endedGame } = room.removeSeat('session-0');
    expect(endedGame).toBe(false);
    expect(room.hostId).toBe(secondSeatId);
    expect(room.lobbyPlayers()).toHaveLength(2);
  });

  it('truncates and defaults display names', () => {
    const room = new BeanieRoom();
    const long = room.hello('s1', 'x'.repeat(40), 'create');
    expect(long.ok && long.seat.name.length).toBe(16);
    const blank = room.hello('s2', '   ', 'join');
    expect(blank.ok && blank.seat.name).toBe('Player');
  });
});

describe('starting a game', () => {
  it('requires the host', () => {
    const room = roomWithPlayers(2);
    const result = room.start(room.seats[1]!.id, 42);
    expect(result.ok).toBe(false);
  });

  it('requires at least 2 players', () => {
    const room = roomWithPlayers(1);
    const result = room.start(room.hostId!, 42);
    expect(result.ok).toBe(false);
  });

  it('creates an all-human game and assigns engine ids in seat order', () => {
    const room = roomWithPlayers(3);
    const result = room.start(room.hostId!, 42);
    expect(result.ok).toBe(true);
    expect(room.phase).toBe('playing');
    expect(room.game!.players.every((p) => !p.isAI)).toBe(true);
    expect(room.seats.map((s) => s.engineId)).toEqual(['player-0', 'player-1', 'player-2']);
    expect(room.game!.players.map((p) => p.name)).toEqual(['Player 0', 'Player 1', 'Player 2']);
  });

  it('cannot start twice', () => {
    const room = roomWithPlayers(2);
    room.start(room.hostId!, 42);
    expect(room.start(room.hostId!, 43).ok).toBe(false);
  });
});

describe('game action validation', () => {
  it('applies the current player\'s action and rejects out-of-turn actions', () => {
    const room = roomWithPlayers(2);
    room.start(room.hostId!, 42);

    const currentEngineId = currentPlayer(room.game!).id;
    const currentSeat = room.seats.find((s) => s.engineId === currentEngineId)!;
    const otherSeat = room.seats.find((s) => s.engineId !== currentEngineId)!;

    const rejected = room.applyGameAction(otherSeat.id, { type: 'DRAW' });
    expect(rejected).toMatchObject({ ok: false, code: 'INVALID' });

    const before = room.game!.players.find((p) => p.id === currentEngineId)!.hand.length;
    const accepted = room.applyGameAction(currentSeat.id, { type: 'DRAW' });
    expect(accepted.ok).toBe(true);
    expect(room.game!.players.find((p) => p.id === currentEngineId)!.hand.length).toBe(before + 1);
  });

  it('returns engine errors without mutating state', () => {
    const room = roomWithPlayers(2);
    room.start(room.hostId!, 42);
    const seat = room.seats.find((s) => s.engineId === currentPlayer(room.game!).id)!;
    const snapshot = room.game;

    // discarding is illegal before drawing
    const result = room.applyGameAction(seat.id, { type: 'DISCARD', cardId: 'nope' });
    expect(result.ok).toBe(false);
    expect(room.game).toBe(snapshot);
  });

  it('rejects actions when no game is running', () => {
    const room = roomWithPlayers(2);
    const result = room.applyGameAction(room.hostId!, { type: 'DRAW' });
    expect(result.ok).toBe(false);
  });
});

describe('leaving and rematch', () => {
  it('ends the game when a seat is removed mid-game', () => {
    const room = roomWithPlayers(2);
    room.start(room.hostId!, 42);
    const { endedGame } = room.removeSeat('session-1');
    expect(endedGame).toBe(true);
    expect(room.game).toBeNull();
  });

  it('host can rematch after game end, returning the room to lobby', () => {
    const room = roomWithPlayers(2);
    room.start(room.hostId!, 42);
    room.phase = 'ended'; // simulate a finished game
    const result = room.rematch(room.hostId!);
    expect(result.ok).toBe(true);
    expect(room.phase).toBe('lobby');
    expect(room.game).toBeNull();
    expect(room.seats.every((s) => s.engineId === null)).toBe(true);
  });

  it('non-host cannot rematch', () => {
    const room = roomWithPlayers(2);
    room.start(room.hostId!, 42);
    room.phase = 'ended';
    expect(room.rematch(room.seats[1]!.id).ok).toBe(false);
  });

  it('cannot rematch mid-game', () => {
    const room = roomWithPlayers(2);
    room.start(room.hostId!, 42);
    expect(room.rematch(room.hostId!).ok).toBe(false);
  });
});
