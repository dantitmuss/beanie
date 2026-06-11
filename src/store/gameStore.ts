import { create } from 'zustand';
import type { CardInSet, CardSet, GameState } from '../engine/types';
import { applyAction } from '../engine/actions';
import { createInitialState, currentPlayer } from '../engine/state';
import { makePolicy } from '../ai/policy';
import { validateWeights } from '../ai/weights/schema';
import type { AIPolicy, Difficulty } from '../ai/types';
import easyData from '../ai/weights/easy.json';
import mediumData from '../ai/weights/medium.json';
import hardData from '../ai/weights/hard.json';

const WEIGHTS = {
  easy: validateWeights(easyData, 'easy'),
  medium: validateWeights(mediumData, 'medium'),
  hard: validateWeights(hardData, 'hard'),
} as const;

interface GameStore {
  state: GameState | null;
  /** 'local' = single-player vs AI; 'mp' = state is server-owned, actions go over the wire. */
  mode: 'local' | 'mp';
  mpSend: ((action: Parameters<typeof applyAction>[1]) => void) | null;
  mpLeave: (() => void) | null;
  toastMessage: string | null;
  selectedHandCardIds: Set<string>;
  handOrder: string[];
  aiRunning: boolean;
  aiPolicy: AIPolicy | null;

  startGame: (playerCount: number, difficulty: Difficulty) => void;
  resetToTitle: () => void;
  dispatch: (action: Parameters<typeof applyAction>[1]) => void;
  toast: (msg: string) => void;
  dismissToast: () => void;
  toggleHandCardSelection: (cardId: string) => void;
  clearSelection: () => void;
  reorderHand: (activeId: string, overId: string) => void;
  reconcileHandOrder: (hand: { id: string }[]) => void;
}

function reconcile(handOrder: string[], hand: { id: string }[]): string[] {
  const handIds = new Set(hand.map((c) => c.id));
  const kept = handOrder.filter((id) => handIds.has(id));
  const newOnes = hand.map((c) => c.id).filter((id) => !kept.includes(id));
  return [...kept, ...newOnes];
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  mode: 'local',
  mpSend: null,
  mpLeave: null,
  toastMessage: null,
  selectedHandCardIds: new Set(),
  handOrder: [],
  aiRunning: false,
  aiPolicy: null,

  startGame(playerCount, difficulty) {
    const names = ['You', 'Aria', 'Bo', 'Cleo'];
    const state = createInitialState(names.slice(0, playerCount), Date.now());
    const aiPolicy = makePolicy(difficulty, WEIGHTS[difficulty]);
    set({ state, mode: 'local', aiPolicy, selectedHandCardIds: new Set(), toastMessage: null, aiRunning: false, handOrder: [] });
  },

  resetToTitle() {
    const { mode, mpLeave } = get();
    if (mode === 'mp') {
      // mpLeave (multiplayer/client.ts leaveRoom) resets both stores itself.
      mpLeave?.();
      return;
    }
    set({ state: null, aiPolicy: null, selectedHandCardIds: new Set(), toastMessage: null, aiRunning: false, handOrder: [] });
  },

  dispatch(action) {
    const { state, mode, mpSend } = get();
    if (!state) return;
    if (mode === 'mp') {
      // Server is authoritative: send the intent and wait for the broadcast
      // GAME_STATE (or an ERROR toast) instead of applying locally.
      mpSend?.(action);
      return;
    }
    try {
      const next = applyAction(state, action);
      set({ state: next });
      maybeRunAI();
    } catch (err) {
      get().toast(err instanceof Error ? err.message : 'Invalid move');
    }
  },

  toast(msg) {
    set({ toastMessage: msg });
  },

  dismissToast() {
    set({ toastMessage: null });
  },

  toggleHandCardSelection(cardId) {
    const { selectedHandCardIds } = get();
    const next = new Set(selectedHandCardIds);
    if (next.has(cardId)) {
      next.delete(cardId);
    } else {
      next.add(cardId);
    }
    set({ selectedHandCardIds: next });
  },

  clearSelection() {
    set({ selectedHandCardIds: new Set() });
  },

  reorderHand(activeId, overId) {
    const { handOrder } = get();
    const from = handOrder.indexOf(activeId);
    const to = handOrder.indexOf(overId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...handOrder];
    next.splice(from, 1);
    next.splice(to, 0, activeId);
    set({ handOrder: next });
  },

  reconcileHandOrder(hand) {
    const { handOrder } = get();
    set({ handOrder: reconcile(handOrder, hand) });
  },
}));

function maybeRunAI() {
  const { state, aiRunning, aiPolicy } = useGameStore.getState();
  if (!state || state.phase === 'gameOver' || state.phase === 'rearranging') return;
  if (aiRunning || !aiPolicy) return;

  const player = currentPlayer(state);
  if (!player.isAI) return;

  useGameStore.setState({ aiRunning: true });

  const actions = aiPolicy.computeTurn(state, player.id);
  let delay = 400;

  for (const action of actions) {
    const capturedAction = action;
    setTimeout(() => {
      const current = useGameStore.getState().state;
      if (!current || current.phase === 'gameOver') {
        useGameStore.setState({ aiRunning: false });
        return;
      }
      try {
        const next = applyAction(current, capturedAction);
        useGameStore.setState({ state: next });
        if (capturedAction === actions[actions.length - 1]) {
          useGameStore.setState({ aiRunning: false });
          setTimeout(() => maybeRunAI(), 200);
        }
      } catch {
        useGameStore.setState({ aiRunning: false });
      }
    }, delay);
    delay += 400;
  }

  if (actions.length === 0) {
    useGameStore.setState({ aiRunning: false });
  }
}

export function buildSetFromSelected(
  selectedIds: Set<string>,
  state: GameState,
): { cards: CardInSet[]; kind: 'group' | 'run' } | null {
  const player = state.players[0]!;
  const selected = player.hand.filter((c) => selectedIds.has(c.id));
  if (selected.length < 3) return null;
  const cards: CardInSet[] = selected.map((c) => ({ card: c }));
  const suits = new Set(selected.filter((c) => c.rank !== 'A').map((c) => c.suit));
  const kind: CardSet['kind'] = suits.size === 1 ? 'run' : 'group';
  return { cards, kind };
}
