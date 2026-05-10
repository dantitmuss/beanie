import { useState } from 'react';
import CardView from './CardView';
import DiscardPileModal from './DiscardPileModal';
import type { Card } from '../engine/types';

interface Props {
  topCard: Card | null;
  pile: Card[];
  onClick?: () => void;
  disabled?: boolean;
}

export default function DiscardPile({ topCard, pile, onClick, disabled = false }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || !topCard}
          aria-label={topCard ? `Discard pile, take all ${pile.length} cards. Top card: ${topCard.rank}${topCard.suit}` : 'Discard pile, empty'}
          className="relative disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] rounded-[8px]"
        >
          {topCard ? (
            <CardView cardInSet={{ card: topCard }} />
          ) : (
            <div className="w-[72px] h-[104px] rounded-[8px] border-2 border-dashed border-[#E4E4E7] flex items-center justify-center">
              <span className="text-[#71717A] text-xs">Empty</span>
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="View discard pile"
          className="text-xs text-[#6366F1] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] rounded"
        >
          {pile.length} cards
        </button>
      </div>

      {modalOpen && (
        <DiscardPileModal pile={pile} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
