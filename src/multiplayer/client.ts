import PartySocket from 'partysocket';
import type { ServerMessage, ClientMessage } from '../../party/messages';
import type { Action } from '../engine/actions';
import type { GameState } from '../engine/types';
import { getSessionId } from './session';
import { useMpStore } from './store';
import { useGameStore } from '../store/gameStore';

const MAX_CREATE_ATTEMPTS = 8;

let socket: PartySocket | null = null;
let intent: 'create' | 'join' = 'join';
let displayName = '';
let createAttempts = 0;
let closing = false;

function partyHost(): string {
  return (import.meta.env.VITE_PARTYKIT_HOST as string | undefined) ?? 'localhost:1999';
}

function randomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

export function createRoom(name: string) {
  createAttempts = 0;
  connect(randomCode(), 'create', name);
}

export function joinRoom(code: string, name: string) {
  connect(code, 'join', name);
}

function connect(code: string, asIntent: 'create' | 'join', name: string) {
  destroySocket();
  closing = false;
  intent = asIntent;
  displayName = name;

  useMpStore.setState({ code, connection: 'connecting', joinError: null });
  useGameStore.setState({ mode: 'mp', mpSend: sendAction, mpLeave: leaveRoom });

  socket = new PartySocket({ host: partyHost(), room: code });

  socket.addEventListener('open', () => {
    send({ type: 'HELLO', sessionId: getSessionId(), displayName, intent });
  });

  socket.addEventListener('message', (e) => {
    try {
      handleServerMessage(JSON.parse(e.data as string) as ServerMessage);
    } catch {
      // ignore malformed frames
    }
  });

  socket.addEventListener('close', () => {
    if (closing) return;
    // PartySocket retries automatically; reflect that in the UI if we were in
    const { connection } = useMpStore.getState();
    if (connection === 'open') {
      useMpStore.setState({ connection: 'reconnecting' });
    }
  });
}

export function handleServerMessage(msg: ServerMessage) {
  switch (msg.type) {
    case 'LOBBY_STATE': {
      // Room established: any future reconnect must resume, never re-create.
      intent = 'join';
      useMpStore.setState({
        active: true,
        screen: 'lobby',
        code: msg.code,
        selfId: msg.selfId,
        hostId: msg.hostId,
        roomPhase: msg.phase,
        players: msg.players,
        connection: 'open',
        joinError: null,
      });
      if (msg.phase === 'lobby') {
        // Fresh lobby or rematch: drop any finished game from the board.
        useGameStore.setState({ state: null, selectedHandCardIds: new Set(), handOrder: [] });
      }
      return;
    }

    case 'GAME_STATE': {
      // Opponent hands and the draw pile arrive as { id, hidden: true }
      // placeholders; the UI only reads counts/ids from them, so the cast is
      // safe as long as nothing renders a non-self hand face-up.
      const state = msg.state as unknown as GameState;
      useGameStore.setState({ state, mode: 'mp' });
      useGameStore.getState().reconcileHandOrder(state.players[0]!.hand);
      useMpStore.setState({ connection: 'open' });
      return;
    }

    case 'ERROR': {
      const fatal = msg.code === 'ROOM_TAKEN' || msg.code === 'NOT_FOUND'
        || msg.code === 'STARTED' || msg.code === 'FULL';
      if (fatal) {
        destroySocket();
        if (msg.code === 'ROOM_TAKEN' && createAttempts < MAX_CREATE_ATTEMPTS) {
          createAttempts += 1;
          connect(randomCode(), 'create', displayName);
          return;
        }
        useMpStore.setState({ connection: 'idle', joinError: msg.message, code: null });
        return;
      }
      useGameStore.getState().toast(msg.message);
      return;
    }

    case 'ROOM_CLOSED': {
      leaveRoom();
      useGameStore.getState().toast(msg.reason);
      return;
    }
  }
}

export function sendAction(action: Action) {
  send({ type: 'GAME_ACTION', action });
}

export function startGame() {
  send({ type: 'START_GAME' });
}

export function requestRematch() {
  send({ type: 'REQUEST_REMATCH' });
}

/** Tear down the connection and return both stores to the title screen. */
export function leaveRoom() {
  if (socket && socket.readyState === socket.OPEN) {
    send({ type: 'LEAVE' });
  }
  destroySocket();
  useMpStore.getState().reset();
  useGameStore.setState({
    state: null,
    mode: 'local',
    mpSend: null,
    mpLeave: null,
    selectedHandCardIds: new Set(),
    handOrder: [],
    toastMessage: null,
  });
}

function send(msg: ClientMessage) {
  socket?.send(JSON.stringify(msg));
}

function destroySocket() {
  if (!socket) return;
  closing = true;
  socket.close();
  socket = null;
}
