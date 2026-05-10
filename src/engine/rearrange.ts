import type { Card, CardSet, GameState, PlayerId } from './types';
import { isValidSet } from './sets';

export interface TableValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateTable(
  state: GameState,
  opts: { activePlayerId: PlayerId; openingProtection: PlayerId[] },
): TableValidationResult {
  const errors: string[] = [];

  for (const set of state.table) {
    const result = isValidSet(set, { minSize: 3 });
    if (!result.ok) {
      errors.push(`Set ${set.id}: ${result.reason ?? 'invalid'}`);
    }
  }

  for (const pid of opts.openingProtection) {
    const playerSets = state.table.filter((s) => s.ownerId === pid);
    const hasFourPlusSet = playerSets.some((s) => s.cards.length >= 4);
    if (!hasFourPlusSet) {
      const player = state.players.find((p) => p.id === pid);
      errors.push(`${player?.name ?? pid} must retain a 4-card opening set`);
    }
  }

  const activePlayer = state.players.find((p) => p.id === opts.activePlayerId);
  if (activePlayer && !activePlayer.hasOpened) {
    const activeSets = state.table.filter((s) => s.ownerId === opts.activePlayerId);
    const hasOpeningSet = activeSets.some((s) => s.cards.length >= 4);
    if (!hasOpeningSet && activeSets.length > 0) {
      errors.push('Your first set must contain at least 4 cards');
    }
  }

  return { ok: errors.length === 0, errors };
}

export interface CommitResult {
  ok: boolean;
  errors: string[];
}

export function canCommitRearrange(
  prev: GameState,
  next: GameState,
  activePlayerId: PlayerId,
): CommitResult {
  const errors: string[] = [];

  const prevTableCardIds = new Set(
    prev.table.flatMap((s) => s.cards.map((c) => c.card.id)),
  );
  const prevActiveHandIds = new Set(
    prev.players.find((p) => p.id === activePlayerId)?.hand.map((c) => c.id) ?? [],
  );
  const nextTableCardIds = new Set(
    next.table.flatMap((s) => s.cards.map((c) => c.card.id)),
  );

  for (const id of nextTableCardIds) {
    if (!prevTableCardIds.has(id) && !prevActiveHandIds.has(id)) {
      errors.push(`Card ${id} appeared on table from an invalid source`);
    }
  }

  for (const player of prev.players) {
    if (player.id === activePlayerId) continue;
    const prevHand = new Set(player.hand.map((c) => c.id));
    const nextPlayer = next.players.find((p) => p.id === player.id);
    if (!nextPlayer) continue;
    const nextHand = new Set(nextPlayer.hand.map((c) => c.id));
    for (const id of prevHand) {
      if (!nextHand.has(id)) {
        errors.push(`Card ${id} removed from ${player.name}'s hand illegally`);
      }
    }
    for (const id of nextHand) {
      if (!prevHand.has(id)) {
        errors.push(`Card ${id} added to ${player.name}'s hand illegally`);
      }
    }
  }

  const prevAllIds = getAllCardIds(prev);
  const nextAllIds = getAllCardIds(next);
  for (const id of prevAllIds) {
    if (!nextAllIds.has(id)) {
      errors.push(`Card ${id} went missing`);
    }
  }
  for (const id of nextAllIds) {
    if (!prevAllIds.has(id)) {
      errors.push(`Card ${id} appeared from nowhere`);
    }
  }

  const openingProtection = prev.players
    .filter((p) => p.id !== activePlayerId && p.hasOpened)
    .map((p) => p.id);

  const tableResult = validateTable(next, { activePlayerId, openingProtection });
  errors.push(...tableResult.errors);

  return { ok: errors.length === 0, errors };
}

function getAllCardIds(state: GameState): Set<string> {
  const ids = new Set<string>();
  for (const p of state.players) {
    for (const c of p.hand) ids.add(c.id);
  }
  for (const c of state.drawPile) ids.add(c.id);
  for (const c of state.discardPile) ids.add(c.id);
  for (const s of state.table) {
    for (const c of s.cards) ids.add(c.card.id);
  }
  return ids;
}

export function buildRearrangedState(
  base: GameState,
  nextTable: CardSet[],
  nextActiveHand: Card[],
  activePlayerId: PlayerId,
): GameState {
  return {
    ...base,
    table: nextTable,
    players: base.players.map((p) =>
      p.id === activePlayerId ? { ...p, hand: nextActiveHand } : p,
    ),
  };
}
