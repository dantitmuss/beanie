/**
 * Integration smoke test for the multiplayer server.
 * Run `npx partykit dev` first, then `npx tsx scripts/mp-smoke.ts`.
 *
 * Drives two real WebSocket clients through: create → join → start →
 * out-of-turn rejection → draw → discard → disconnect notice.
 */
import PartySocket from 'partysocket';
import type { ClientMessage, ServerMessage, RedactedGameState } from '../party/messages';

const HOST = process.env.PARTYKIT_HOST ?? 'localhost:1999';
const ROOM = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

class TestClient {
  socket: PartySocket;
  inbox: ServerMessage[] = [];
  private waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];

  constructor(readonly name: string, sessionId: string, intent: 'create' | 'join') {
    this.socket = new PartySocket({ host: HOST, room: ROOM });
    this.socket.addEventListener('open', () => {
      this.send({ type: 'HELLO', sessionId, displayName: name, intent });
    });
    this.socket.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data as string) as ServerMessage;
      this.inbox.push(msg);
      const idx = this.waiters.findIndex((w) => w.match(msg));
      if (idx !== -1) {
        const [waiter] = this.waiters.splice(idx, 1);
        waiter!.resolve(msg);
      }
    });
  }

  send(msg: ClientMessage) {
    this.socket.send(JSON.stringify(msg));
  }

  waitFor<T extends ServerMessage>(match: (m: ServerMessage) => m is T, timeoutMs = 5000): Promise<T> {
    const existing = this.inbox.find(match);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${this.name}: timed out waiting for message`)),
        timeoutMs,
      );
      this.waiters.push({
        match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as T);
        },
      });
    });
  }

  clear() {
    this.inbox = [];
  }
}

const isLobby = (m: ServerMessage): m is Extract<ServerMessage, { type: 'LOBBY_STATE' }> =>
  m.type === 'LOBBY_STATE';
const isGame = (m: ServerMessage): m is Extract<ServerMessage, { type: 'GAME_STATE' }> =>
  m.type === 'GAME_STATE';
const isError = (m: ServerMessage): m is Extract<ServerMessage, { type: 'ERROR' }> =>
  m.type === 'ERROR';

function assert(cond: unknown, label: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

function ownHandVisible(state: RedactedGameState): boolean {
  return state.players[0]!.hand.every((c) => 'rank' in c && 'suit' in c);
}

function opponentsHidden(state: RedactedGameState): boolean {
  return state.players.slice(1).every((p) => p.hand.every((c) => 'hidden' in c));
}

async function main() {
  console.log(`Room ${ROOM} on ${HOST}`);

  console.log('1. Host creates room');
  const host = new TestClient('Dan', 'session-host', 'create');
  let lobby = await host.waitFor(isLobby);
  assert(lobby.players.length === 1, 'host alone in lobby');
  assert(lobby.hostId === lobby.selfId, 'creator is host');

  console.log('2. Guest joins');
  const guest = new TestClient('Aria', 'session-guest', 'join');
  await guest.waitFor(isLobby);
  lobby = await host.waitFor((m): m is typeof lobby => isLobby(m) && m.players.length === 2);
  assert(lobby.players.map((p) => p.name).join(',') === 'Dan,Aria', 'both players listed');

  console.log('3. Guest cannot start; host starts');
  guest.send({ type: 'START_GAME' });
  const startErr = await guest.waitFor(isError);
  assert(/host/i.test(startErr.message), 'non-host start rejected');

  host.clear();
  guest.clear();
  host.send({ type: 'START_GAME' });
  const hostGame = await host.waitFor(isGame);
  const guestGame = await guest.waitFor(isGame);

  assert(hostGame.state.players[0]!.name === 'Dan', 'host sees self at players[0]');
  assert(guestGame.state.players[0]!.name === 'Aria', 'guest sees self at players[0]');
  assert(ownHandVisible(hostGame.state) && ownHandVisible(guestGame.state), 'own hands visible');
  assert(opponentsHidden(hostGame.state) && opponentsHidden(guestGame.state), 'opponent hands hidden');
  assert(hostGame.state.drawPile.every((c) => 'hidden' in c), 'draw pile hidden');
  assert(hostGame.state.rngSeed === 0, 'rng seed stripped');

  console.log('4. Out-of-turn action rejected');
  const current = hostGame.state.turnOrder[hostGame.state.currentPlayerIdx];
  const [turnClient, idleClient] = current === 'player-0' ? [host, guest] : [guest, host];
  idleClient.clear();
  idleClient.send({ type: 'GAME_ACTION', action: { type: 'DRAW' } });
  const turnErr = await idleClient.waitFor(isError);
  assert(/turn/i.test(turnErr.message), 'out-of-turn draw rejected');

  console.log('5. Current player draws and discards');
  turnClient.clear();
  idleClient.clear();
  turnClient.send({ type: 'GAME_ACTION', action: { type: 'DRAW' } });
  const afterDraw = await turnClient.waitFor(isGame);
  assert(afterDraw.state.players[0]!.hand.length === 10, 'drew to 10 cards');
  assert(afterDraw.state.phase === 'inTurn', 'phase advanced to inTurn');

  const discardId = afterDraw.state.players[0]!.hand[0]!.id;
  turnClient.send({ type: 'GAME_ACTION', action: { type: 'DISCARD', cardId: discardId } });
  const afterDiscard = await idleClient.waitFor(
    (m): m is Extract<ServerMessage, { type: 'GAME_STATE' }> => isGame(m) && m.state.phase === 'awaitingDraw',
  );
  assert(
    afterDiscard.state.turnOrder[afterDiscard.state.currentPlayerIdx] !== current,
    'turn passed to the other player',
  );
  assert(afterDiscard.state.discardPile[0]!.id === discardId, 'discard is public');

  console.log('6. Disconnect marks the seat');
  guest.socket.close();
  const dcLobby = await host.waitFor(
    (m): m is Extract<ServerMessage, { type: 'LOBBY_STATE' }> =>
      isLobby(m) && m.players.some((p) => !p.connected),
  );
  assert(dcLobby.players.find((p) => p.name === 'Aria')!.connected === false, 'guest shown disconnected');

  console.log('7. Reconnect resumes the seat mid-game');
  host.clear();
  const guest2 = new TestClient('Aria', 'session-guest', 'join');
  const resumedGame = await guest2.waitFor(isGame);
  assert(resumedGame.state.players[0]!.name === 'Aria', 'resumed client gets its own view back');
  const reLobby = await host.waitFor(
    (m): m is Extract<ServerMessage, { type: 'LOBBY_STATE' }> =>
      isLobby(m) && m.players.every((p) => p.connected),
  );
  assert(reLobby.players.length === 2, 'seat resumed, not duplicated');
  guest2.socket.close();

  console.log('\nALL SMOKE TESTS PASSED');
  host.socket.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
