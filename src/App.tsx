import Title from './ui/Title';
import GameBoard from './ui/GameBoard';
import EndGameModal from './ui/EndGameModal';
import { useGameStore } from './store/gameStore';

export default function App() {
  const { state, startGame, resetToTitle } = useGameStore();

  if (!state) {
    return <Title onStartGame={startGame} />;
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
