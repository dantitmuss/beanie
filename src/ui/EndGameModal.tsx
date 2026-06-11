interface Props {
  winnerName: string;
  isHumanWinner: boolean;
  /** Primary action; omit to show only a waiting note (mp non-host). */
  onPlayAgain?: () => void;
  playAgainLabel?: string;
  /** Shown instead of the primary button when onPlayAgain is absent. */
  waitingNote?: string;
  /** Secondary action (mp: leave the room). */
  onLeave?: () => void;
}

export default function EndGameModal({
  winnerName,
  isHumanWinner,
  onPlayAgain,
  playAgainLabel = 'Play again',
  waitingNote,
  onLeave,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="endgame-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-8 flex flex-col items-center gap-6 text-center">
        <div className="text-5xl">{isHumanWinner ? '🎉' : '🃏'}</div>

        <div>
          <h2 id="endgame-title" className="text-2xl font-semibold text-[#0A0A0A] mb-1">
            {isHumanWinner ? 'You won!' : `${winnerName} won`}
          </h2>
          <p className="text-sm text-[#71717A]">
            {isHumanWinner
              ? 'Nice work — you cleared your hand!'
              : 'Better luck next time.'}
          </p>
        </div>

        {onPlayAgain ? (
          <button
            type="button"
            onClick={onPlayAgain}
            autoFocus
            className="w-full py-3 bg-[#6366F1] text-white rounded-lg font-medium hover:bg-[#4F46E5] transition-colors"
          >
            {playAgainLabel}
          </button>
        ) : (
          waitingNote && (
            <p className="text-sm text-[#71717A] animate-pulse">{waitingNote}</p>
          )
        )}

        {onLeave && (
          <button
            type="button"
            onClick={onLeave}
            className="text-sm text-[#71717A] hover:text-[#DC2626] transition-colors -mt-2"
          >
            Leave room
          </button>
        )}
      </div>
    </div>
  );
}
