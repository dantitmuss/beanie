import type { Card, GameState, PlayerId } from '../src/engine/types';
import type { HiddenCard, RedactedGameState, RedactedPlayer } from './messages';

function hide(card: Card): HiddenCard {
  return { id: card.id, hidden: true };
}

/**
 * Produce the view of `state` that `viewerId` is allowed to see:
 * - players rotated so the viewer is index 0 (the UI treats players[0] as "you")
 * - every other player's hand reduced to hidden placeholders (ids kept so counts
 *   and rearrange validation still line up)
 * - draw pile contents hidden, rngSeed zeroed (either would let a client
 *   reconstruct the shuffle)
 * - rearrangeSnapshot redacted recursively with the same rules
 */
export function redactFor(state: GameState, viewerId: PlayerId): RedactedGameState {
  const viewerIdx = state.players.findIndex((p) => p.id === viewerId);
  const rotated =
    viewerIdx <= 0
      ? state.players
      : [...state.players.slice(viewerIdx), ...state.players.slice(0, viewerIdx)];

  const players: RedactedPlayer[] = rotated.map((p) =>
    p.id === viewerId ? { ...p, hand: [...p.hand] } : { ...p, hand: p.hand.map(hide) },
  );

  return {
    ...state,
    players,
    drawPile: state.drawPile.map(hide),
    rngSeed: 0,
    rearrangeSnapshot: state.rearrangeSnapshot
      ? redactFor(state.rearrangeSnapshot, viewerId)
      : undefined,
  };
}
