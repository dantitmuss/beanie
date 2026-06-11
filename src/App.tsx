import Title from './ui/Title';
import GameBoard from './ui/GameBoard';
import EndGameModal from './ui/EndGameModal';
import MultiplayerMenu from './ui/MultiplayerMenu';
import CreateRoomScreen from './ui/CreateRoomScreen';
import JoinRoomScreen from './ui/JoinRoomScreen';
import LobbyScreen from './ui/LobbyScreen';
import Toast from './ui/Toast';
import { useGameStore } from './store/gameStore';
import { useMpStore } from './multiplayer/store';
import { leaveRoom, requestRematch } from './multiplayer/client';

export default function App() {
  const { state, startGame, resetToTitle, toastMessage, dismissToast } = useGameStore();
  const mp = useMpStore();

  if (mp.active) {
    if (state) {
      const isHost = mp.selfId !== null && mp.selfId === mp.hostId;
      return (
        <>
          <GameBoard />
          {state.phase === 'gameOver' && state.winner && (
            <EndGameModal
              winnerName={state.players.find((p) => p.id === state.winner)?.name ?? 'Someone'}
              isHumanWinner={state.winner === state.players[0]!.id}
              onPlayAgain={isHost ? requestRematch : undefined}
              playAgainLabel="Rematch"
              waitingNote={isHost ? undefined : 'Waiting for the host to start a rematch…'}
              onLeave={leaveRoom}
            />
          )}
        </>
      );
    }

    const screen = {
      menu: <MultiplayerMenu />,
      create: <CreateRoomScreen />,
      join: <JoinRoomScreen />,
      lobby: <LobbyScreen />,
    }[mp.screen];

    return (
      <>
        {screen}
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      </>
    );
  }

  if (!state) {
    return (
      <>
        <Title
          onStartGame={startGame}
          onPlayFriends={() => useMpStore.getState().openMenu()}
        />
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      </>
    );
  }

  return (
    <>
      <GameBoard />
      {state.phase === 'gameOver' && state.winner && (
        <EndGameModal
          winnerName={state.players.find((p) => p.id === state.winner)?.name ?? 'Someone'}
          isHumanWinner={state.winner === state.players[0]!.id}
          onPlayAgain={resetToTitle}
        />
      )}
    </>
  );
}
