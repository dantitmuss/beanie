import { create } from 'zustand';
import type { LobbyPlayer, RoomPhase } from '../../party/messages';

export type MpScreen = 'menu' | 'create' | 'join' | 'lobby';
export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

interface MpStore {
  /** True while the multiplayer flow owns the screen (menu through game). */
  active: boolean;
  screen: MpScreen;
  code: string | null;
  selfId: string | null;
  hostId: string | null;
  roomPhase: RoomPhase;
  players: LobbyPlayer[];
  connection: ConnectionStatus;
  /** Error shown on the create/join screens (room not found, full, …). */
  joinError: string | null;

  openMenu: () => void;
  setScreen: (screen: MpScreen) => void;
  reset: () => void;
}

const initial = {
  active: false,
  screen: 'menu' as MpScreen,
  code: null,
  selfId: null,
  hostId: null,
  roomPhase: 'lobby' as RoomPhase,
  players: [],
  connection: 'idle' as ConnectionStatus,
  joinError: null,
};

export const useMpStore = create<MpStore>((set) => ({
  ...initial,

  openMenu() {
    set({ ...initial, active: true, screen: 'menu' });
  },

  setScreen(screen) {
    set({ screen, joinError: null });
  },

  reset() {
    set({ ...initial });
  },
}));

export function isSelfHost(): boolean {
  const { selfId, hostId } = useMpStore.getState();
  return selfId !== null && selfId === hostId;
}
