import { describe, expect, it } from 'vitest';
import { redactFor } from '../redact';
import { createInitialState } from '../../src/engine/state';
import { applyAction } from '../../src/engine/actions';
import type { Card } from '../../src/engine/types';

const isHidden = (c: unknown): boolean =>
  typeof c === 'object' && c !== null && (c as { hidden?: boolean }).hidden === true;

function makeState() {
  return createInitialState(['Dan', 'Aria', 'Bo'], 1234);
}

describe('redactFor', () => {
  it('keeps the viewer hand intact and hides all other hands', () => {
    const state = makeState();
    const view = redactFor(state, 'player-1');

    const self = view.players.find((p) => p.id === 'player-1')!;
    expect(self.hand).toEqual(state.players[1]!.hand);

    for (const p of view.players.filter((p) => p.id !== 'player-1')) {
      expect(p.hand.every(isHidden)).toBe(true);
      expect(p.hand.every((c) => !('rank' in c) && !('suit' in c))).toBe(true);
    }
  });

  it('rotates players so the viewer is index 0, preserving turnOrder', () => {
    const state = makeState();
    const view = redactFor(state, 'player-2');
    expect(view.players.map((p) => p.id)).toEqual(['player-2', 'player-0', 'player-1']);
    expect(view.turnOrder).toEqual(state.turnOrder);
    expect(view.currentPlayerIdx).toBe(state.currentPlayerIdx);
  });

  it('preserves card ids and hand lengths', () => {
    const state = makeState();
    const view = redactFor(state, 'player-0');
    for (const original of state.players) {
      const redacted = view.players.find((p) => p.id === original.id)!;
      expect(redacted.hand.map((c) => c.id)).toEqual(original.hand.map((c) => c.id));
    }
  });

  it('hides draw pile contents and zeroes the rng seed', () => {
    const state = makeState();
    const view = redactFor(state, 'player-0');
    expect(view.drawPile).toHaveLength(state.drawPile.length);
    expect(view.drawPile.every(isHidden)).toBe(true);
    expect(view.rngSeed).toBe(0);
  });

  it('leaves public information untouched', () => {
    const state = makeState();
    const view = redactFor(state, 'player-1');
    expect(view.discardPile).toEqual(state.discardPile);
    expect(view.table).toEqual(state.table);
    expect(view.phase).toBe(state.phase);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const handsBefore = state.players.map((p) => p.hand.map((c) => ({ ...c })));
    redactFor(state, 'player-1');
    state.players.forEach((p, i) => {
      expect(p.hand).toEqual(handsBefore[i]);
      expect(p.hand.every((c: Card) => c.rank && c.suit)).toBe(true);
    });
    expect(state.players[0]!.id).toBe('player-0');
  });

  it('redacts the rearrange snapshot recursively', () => {
    let state = makeState();
    state = applyAction(state, { type: 'DRAW' });
    // force player-0 open so START_REARRANGE is legal
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 'player-0' ? { ...p, hasOpened: true } : p)),
    };
    state = applyAction(state, { type: 'START_REARRANGE' });

    const view = redactFor(state, 'player-0');
    expect(view.rearrangeSnapshot).toBeDefined();
    const snapshot = view.rearrangeSnapshot!;
    expect(snapshot.players[0]!.id).toBe('player-0');
    expect(snapshot.players[0]!.hand.every((c) => 'rank' in c)).toBe(true);
    for (const p of snapshot.players.slice(1)) {
      expect(p.hand.every(isHidden)).toBe(true);
    }
    expect(snapshot.drawPile.every(isHidden)).toBe(true);
    expect(snapshot.rngSeed).toBe(0);
  });
});
