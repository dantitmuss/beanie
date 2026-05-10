import { useEffect } from 'react';
import CardView from './CardView';
import type { Card } from '../engine/types';

interface Props {
  pile: Card[];
  onClose: () => void;
}

export default function DiscardPileModal({ pile, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-pile-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E4E7]">
          <h2 id="discard-pile-title" className="text-lg font-semibold text-[#0A0A0A]">
            Discard pile ({pile.length} card{pile.length !== 1 ? 's' : ''})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close discard pile viewer"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#0A0A0A]"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {pile.length === 0 ? (
            <p className="text-sm text-[#71717A] text-center py-4">No cards in the discard pile yet.</p>
          ) : (
            pile.map((card, i) => (
              <div key={card.id} className="flex items-center gap-3">
                {i === 0 && (
                  <span className="text-[10px] uppercase tracking-wide text-[#6366F1] font-semibold w-8 text-right shrink-0">top</span>
                )}
                {i !== 0 && <span className="w-8 shrink-0" />}
                <CardView cardInSet={{ card }} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
