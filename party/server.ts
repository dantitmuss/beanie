import type * as Party from 'partykit/server';
import { BeanieRoom, RECONNECT_WINDOW_MS } from './room-state';
import { redactFor } from './redact';
import type { ClientMessage, ServerMessage } from './messages';

/**
 * One Durable Object per room; the 4-digit code is the PartyKit room id.
 * All game logic lives in BeanieRoom / src/engine — this class only maps
 * connections to seats and fans out per-viewer redacted state.
 */
export default class BeanieServer implements Party.Server {
  private state = new BeanieRoom();
  private sessionByConn = new Map<string, string>();
  private removalTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(readonly room: Party.Room) {}

  onMessage(raw: string | ArrayBuffer | ArrayBufferView, conn: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }

    switch (msg.type) {
      case 'HELLO':
        return this.handleHello(msg, conn);
      case 'START_GAME':
        return this.handleStart(conn);
      case 'GAME_ACTION':
        return this.handleAction(msg.action, conn);
      case 'REQUEST_REMATCH':
        return this.handleRematch(conn);
      case 'LEAVE':
        return this.handleLeave(conn);
    }
  }

  onClose(conn: Party.Connection) {
    const sessionId = this.sessionByConn.get(conn.id);
    if (!sessionId) return;
    this.sessionByConn.delete(conn.id);

    // Another live connection for the same session (e.g. reconnect raced the
    // close event) keeps the seat alive.
    if ([...this.sessionByConn.values()].includes(sessionId)) return;

    const seat = this.state.markDisconnected(sessionId);
    if (!seat) return;

    this.clearRemovalTimer(sessionId);
    this.removalTimers.set(
      sessionId,
      setTimeout(() => this.expireSeat(sessionId), RECONNECT_WINDOW_MS),
    );
    this.broadcastLobby();
  }

  onError(conn: Party.Connection) {
    this.onClose(conn);
  }

  private handleHello(
    msg: Extract<ClientMessage, { type: 'HELLO' }>,
    conn: Party.Connection,
  ) {
    const result = this.state.hello(msg.sessionId, msg.displayName, msg.intent);
    if (!result.ok) {
      this.send(conn, { type: 'ERROR', code: result.code, message: result.message });
      conn.close();
      return;
    }

    this.sessionByConn.set(conn.id, msg.sessionId);
    this.clearRemovalTimer(msg.sessionId);
    this.broadcastLobby();

    if (result.resumed && this.state.game && result.seat.engineId) {
      this.send(conn, {
        type: 'GAME_STATE',
        state: redactFor(this.state.game, result.seat.engineId),
      });
    }
  }

  private handleStart(conn: Party.Connection) {
    const seat = this.seatFor(conn);
    if (!seat) return;
    const result = this.state.start(seat.id, Date.now());
    if (!result.ok) {
      this.send(conn, { type: 'ERROR', code: result.code, message: result.message });
      return;
    }
    this.broadcastLobby();
    this.broadcastGame();
  }

  private handleAction(
    action: Extract<ClientMessage, { type: 'GAME_ACTION' }>['action'],
    conn: Party.Connection,
  ) {
    const seat = this.seatFor(conn);
    if (!seat) return;
    const result = this.state.applyGameAction(seat.id, action);
    if (!result.ok) {
      this.send(conn, { type: 'ERROR', code: result.code, message: result.message });
      return;
    }
    this.broadcastGame();
    if (this.state.phase === 'ended') this.broadcastLobby();
  }

  private handleRematch(conn: Party.Connection) {
    const seat = this.seatFor(conn);
    if (!seat) return;
    const result = this.state.rematch(seat.id);
    if (!result.ok) {
      this.send(conn, { type: 'ERROR', code: result.code, message: result.message });
      return;
    }
    this.broadcastLobby();
  }

  private handleLeave(conn: Party.Connection) {
    const sessionId = this.sessionByConn.get(conn.id);
    conn.close();
    if (!sessionId) return;
    this.sessionByConn.delete(conn.id);
    this.clearRemovalTimer(sessionId);
    this.dropSeat(sessionId, 'left the game');
  }

  private expireSeat(sessionId: string) {
    this.removalTimers.delete(sessionId);
    this.dropSeat(sessionId, 'disconnected');
  }

  private dropSeat(sessionId: string, reason: string) {
    const { removed, endedGame } = this.state.removeSeat(sessionId);
    if (!removed) return;

    if (endedGame) {
      this.broadcastAll({ type: 'ROOM_CLOSED', reason: `${removed.name} ${reason}` });
      for (const c of this.room.getConnections()) c.close();
      this.sessionByConn.clear();
      this.state = new BeanieRoom();
      return;
    }
    this.broadcastLobby();
  }

  private seatFor(conn: Party.Connection) {
    const sessionId = this.sessionByConn.get(conn.id);
    return sessionId ? this.state.seatForSession(sessionId) : null;
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcastAll(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }

  /** LOBBY_STATE is per-connection because selfId differs per viewer. */
  private broadcastLobby() {
    const players = this.state.lobbyPlayers();
    for (const conn of this.room.getConnections()) {
      const seat = this.seatFor(conn);
      if (!seat) continue;
      this.send(conn, {
        type: 'LOBBY_STATE',
        code: this.room.id,
        selfId: seat.id,
        hostId: this.state.hostId ?? seat.id,
        phase: this.state.phase,
        players,
      });
    }
  }

  /** GAME_STATE is per-connection: each viewer gets their own redacted view. */
  private broadcastGame() {
    if (!this.state.game) return;
    for (const conn of this.room.getConnections()) {
      const seat = this.seatFor(conn);
      if (!seat?.engineId) continue;
      this.send(conn, {
        type: 'GAME_STATE',
        state: redactFor(this.state.game, seat.engineId),
      });
    }
  }

  private clearRemovalTimer(sessionId: string) {
    const timer = this.removalTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.removalTimers.delete(sessionId);
    }
  }
}
