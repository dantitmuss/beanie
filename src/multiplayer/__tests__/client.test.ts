import { beforeEach, describe, expect, it } from 'vitest';
import { handleServerMessage } from '../client';
import { getSessionId, getDisplayName, setDisplayName } from '../session';
import { useMpStore } from '../store';
import { useGameStore } from '../../store/gameStore';
import { createInitialState } from '../../engine/state';
import { redactFor } from '../../../party/redact';
import type { ServerMessage, LobbyPlayer } from '../../../party/messages';

const lobbyPlayers: LobbyPlayer[] = [
  { id: 'seat-0', name: 'Dan', connected: true, engineId: null },
  { id: 'seat-1', name: 'Aria', connected: true, engineId: null },
];

function lobbyMsg(overrides: Partial<Extract<ServerMessage, { type: 'LOBBY_STATE' }>> = {}) {
  return {
    type: 'LOBBY_STATE',
    code: '4729',
    selfId: 'seat-1',
    hostId: 'seat-0',
    phase: 'lobby',
    players: lobbyPlayers,
    ...overrides,
  } satisfies ServerMessage;
}

beforeEach(() => {
  useMpStore.getState().reset();
  useGameStore.setState({
    state: null,
    mode: 'mp',
    toastMessage: null,
    selectedHandCardIds: new Set(),
    handOrder: [],
  });
});

describe('handleServerMessage', () => {
  it('LOBBY_STATE populates the mp store and shows the lobby', () => {
    handleServerMessage(lobbyMsg());
    const mp = useMpStore.getState();
    expect(mp.code).toBe('4729');
    expect(mp.selfId).toBe('seat-1');
    expect(mp.hostId).toBe('seat-0');
    expect(mp.players).toHaveLength(2);
    expect(mp.screen).toBe('lobby');
    expect(mp.connection).toBe('open');
  });

  it('LOBBY_STATE in lobby phase clears any finished game (rematch flow)', () => {
    useGameStore.setState({ state: createInitialState(['A', 'B'], 1) });
    handleServerMessage(lobbyMsg());
    expect(useGameStore.getState().state).toBeNull();
  });

  it('GAME_STATE feeds the redacted state into the game store', () => {
    const canonical = createInitialState(['Dan', 'Aria'], 99);
    handleServerMessage({ type: 'GAME_STATE', state: redactFor(canonical, 'player-1') });

    const state = useGameStore.getState().state!;
    expect(state).not.toBeNull();
    expect(useGameStore.getState().mode).toBe('mp');
    // viewer rotated to players[0], own hand visible, opponent hidden
    expect(state.players[0]!.id).toBe('player-1');
    expect(state.players[0]!.hand.every((c) => c.rank && c.suit)).toBe(true);
    expect(useGameStore.getState().handOrder).toEqual(state.players[0]!.hand.map((c) => c.id));
  });

  it('non-fatal ERROR becomes a toast (invalid move)', () => {
    handleServerMessage(lobbyMsg());
    handleServerMessage({ type: 'ERROR', code: 'INVALID', message: 'Not your turn' });
    expect(useGameStore.getState().toastMessage).toBe('Not your turn');
    expect(useMpStore.getState().active).toBe(true);
  });

  it('fatal ERROR surfaces as joinError without leaving the mp flow', () => {
    useMpStore.getState().openMenu();
    handleServerMessage({ type: 'ERROR', code: 'NOT_FOUND', message: 'Room not found' });
    const mp = useMpStore.getState();
    expect(mp.joinError).toBe('Room not found');
    expect(mp.connection).toBe('idle');
    expect(mp.active).toBe(true);
  });

  it('ROOM_CLOSED resets everything back to title with a notice', () => {
    handleServerMessage(lobbyMsg());
    useGameStore.setState({ state: createInitialState(['A', 'B'], 1) });
    handleServerMessage({ type: 'ROOM_CLOSED', reason: 'Aria left the game' });

    expect(useMpStore.getState().active).toBe(false);
    expect(useGameStore.getState().state).toBeNull();
    expect(useGameStore.getState().mode).toBe('local');
    expect(useGameStore.getState().toastMessage).toBe('Aria left the game');
  });
});

describe('session', () => {
  it('keeps a stable per-tab session id', () => {
    const a = getSessionId();
    const b = getSessionId();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(10);
    expect(sessionStorage.getItem('beanie:sessionId')).toBe(a);
  });

  it('persists and truncates the display name', () => {
    setDisplayName('  Daniel the Magnificent  ');
    expect(getDisplayName()).toBe('Daniel the Magni');
    expect(getDisplayName().length).toBe(16);
  });
});

describe('gameStore mp dispatch', () => {
  it('routes actions to mpSend instead of applying locally', () => {
    const sent: unknown[] = [];
    const state = createInitialState(['Dan', 'Aria'], 7);
    useGameStore.setState({ state, mode: 'mp', mpSend: (a) => sent.push(a) });

    const before = useGameStore.getState().state;
    useGameStore.getState().dispatch({ type: 'DRAW' });

    expect(sent).toEqual([{ type: 'DRAW' }]);
    expect(useGameStore.getState().state).toBe(before);
  });
});
