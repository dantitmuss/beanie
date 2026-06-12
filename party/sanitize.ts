import type { Action } from '../src/engine/actions';
import type { AceRole, Card, CardInSet, CardSet, GameState, Rank, Suit } from '../src/engine/types';

const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: readonly Suit[] = ['♣', '♦', '♥', '♠'];
const MAX_SET_ID_LENGTH = 64;

export type SanitizeResult = { ok: true; action: Action } | { ok: false; message: string };

/**
 * The engine validates client-submitted cards by id but keeps the submitted
 * objects, which is fine for the trusted local client it was written for. A
 * modified mp client could therefore send a legitimate card id with a forged
 * rank/suit. Before applying PLAY_SET / COMMIT_REARRANGE, replace every
 * submitted card with the server's canonical card for that id and validate
 * the client-chosen fields (aceRole, ownerId, set ids) against known values.
 */
export function sanitizeAction(state: GameState, action: Action): SanitizeResult {
  switch (action.type) {
    case 'PLAY_SET': {
      if (!isKnownPlayer(state, action.ownerId)) {
        return { ok: false, message: 'Unknown set owner' };
      }
      const cards = sanitizeCards(state, action.cards);
      if (!cards.ok) return cards;
      return { ok: true, action: { ...action, cards: cards.cards } };
    }

    case 'COMMIT_REARRANGE': {
      if (!Array.isArray(action.nextTable)) return { ok: false, message: 'Malformed table' };
      const nextTable: CardSet[] = [];
      for (const set of action.nextTable) {
        if (
          typeof set?.id !== 'string' ||
          set.id.length === 0 ||
          set.id.length > MAX_SET_ID_LENGTH ||
          (set.kind !== 'group' && set.kind !== 'run') ||
          !isKnownPlayer(state, set.ownerId)
        ) {
          return { ok: false, message: 'Malformed set' };
        }
        const cards = sanitizeCards(state, set.cards);
        if (!cards.ok) return cards;
        nextTable.push({ id: set.id, ownerId: set.ownerId, kind: set.kind, cards: cards.cards });
      }
      const nextHand = sanitizeCards(state, action.nextHand);
      if (!nextHand.ok) return nextHand;
      return { ok: true, action: { ...action, nextTable, nextHand: nextHand.cards } };
    }

    default:
      return { ok: true, action };
  }
}

function sanitizeCards(
  state: GameState,
  cards: unknown,
): { ok: true; cards: CardInSet[] } | { ok: false; message: string } {
  if (!Array.isArray(cards)) return { ok: false, message: 'Malformed cards' };
  const index = cardIndex(state);
  const out: CardInSet[] = [];
  for (const entry of cards as CardInSet[]) {
    const canonical = index.get(entry?.card?.id as string);
    if (!canonical) return { ok: false, message: 'Unknown card' };
    if (entry.aceRole !== undefined) {
      if (canonical.rank !== 'A' || !isValidAceRole(entry.aceRole)) {
        return { ok: false, message: 'Invalid ace role' };
      }
      out.push({ card: canonical, aceRole: { rank: entry.aceRole.rank, suit: entry.aceRole.suit } });
    } else {
      out.push({ card: canonical });
    }
  }
  return { ok: true, cards: out };
}

function cardIndex(state: GameState): Map<string, Card> {
  const map = new Map<string, Card>();
  for (const p of state.players) for (const c of p.hand) map.set(c.id, c);
  for (const c of state.drawPile) map.set(c.id, c);
  for (const c of state.discardPile) map.set(c.id, c);
  for (const s of state.table) for (const ci of s.cards) map.set(ci.card.id, ci.card);
  return map;
}

function isKnownPlayer(state: GameState, playerId: unknown): boolean {
  return state.players.some((p) => p.id === playerId);
}

// Typed unknown because the value comes off the wire; the declared AceRole
// type already excludes 'A' but a malicious client is not bound by it.
function isValidAceRole(role: unknown): role is AceRole {
  if (typeof role !== 'object' || role === null) return false;
  const r = role as { rank?: unknown; suit?: unknown };
  return r.rank !== 'A' && RANKS.includes(r.rank as Rank) && SUITS.includes(r.suit as Suit);
}
