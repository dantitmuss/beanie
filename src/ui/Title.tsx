import { useState } from 'react';
import BeanieLogo from './BeanieLogo';
import RulesModal from './RulesModal';
import type { Difficulty } from '../ai/types';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

interface Props {
  onStartGame: (playerCount: number, difficulty: Difficulty) => void;
  onPlayFriends: () => void;
}

export default function Title({ onStartGame, onPlayFriends }: Props) {
  const [playerCount, setPlayerCount] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-8 gap-12">
      <div className="flex flex-col items-center gap-4">
        <BeanieLogo size={64} />
        <h1 className="text-5xl font-bold tracking-tight text-[#0A0A0A] leading-none">
          beanie
        </h1>
        <p className="text-[#71717A] text-sm text-center max-w-xs">
          A Gin Rummy-style card game. Clear your hand to win.
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide text-center">
            Players
          </label>
          <div
            className="flex rounded-lg border border-[#E4E4E7] overflow-hidden bg-white"
            role="radiogroup"
            aria-label="Number of players"
          >
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={playerCount === n}
                onClick={() => setPlayerCount(n)}
                className={
                  playerCount === n
                    ? 'flex-1 py-2.5 text-sm font-semibold bg-[#6366F1] text-white transition-colors'
                    : 'flex-1 py-2.5 text-sm text-[#71717A] hover:bg-[#F4F4F5] transition-colors'
                }
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#71717A] text-center">
            You + {playerCount - 1} AI opponent{playerCount > 2 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide text-center">
            Difficulty
          </label>
          <div
            className="flex rounded-lg border border-[#E4E4E7] overflow-hidden bg-white"
            role="radiogroup"
            aria-label="AI difficulty"
          >
            {DIFFICULTIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={difficulty === value}
                onClick={() => setDifficulty(value)}
                className={
                  difficulty === value
                    ? 'flex-1 py-2.5 text-sm font-semibold bg-[#6366F1] text-white transition-colors'
                    : 'flex-1 py-2.5 text-sm text-[#71717A] hover:bg-[#F4F4F5] transition-colors'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onStartGame(playerCount, difficulty)}
          className="w-full py-3 bg-[#6366F1] text-white rounded-lg font-semibold text-base hover:bg-[#4F46E5] active:bg-[#4338CA] transition-colors"
        >
          New game
        </button>

        <button
          type="button"
          onClick={onPlayFriends}
          className="w-full py-3 bg-white text-[#0A0A0A] border border-[#E4E4E7] rounded-lg font-semibold text-base hover:bg-[#F4F4F5] transition-colors"
        >
          Play with friends
        </button>

        <button
          type="button"
          onClick={() => setShowRules(true)}
          className="text-sm text-[#71717A] hover:text-[#0A0A0A] transition-colors"
        >
          How to play
        </button>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
