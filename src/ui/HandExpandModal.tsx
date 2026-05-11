import CardView from './CardView';
import type { Card } from '../engine/types';

interface Props {
  cards: Card[];
  selectedIds: Set<string>;
  onCardClick: (cardId: string) => void;
  onClose: () => void;
}

export default function HandExpandModal({ cards, selectedIds, onCardClick, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      <div
        className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 flex flex-col gap-4 max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#0A0A0A]">
            Your hand ({cards.length} cards)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#71717A] text-lg leading-none px-2 py-1"
            aria-label="Close hand view"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-row flex-wrap gap-2 overflow-y-auto">
          {cards.map((card) => (
            <CardView
              key={card.id}
              cardInSet={{ card }}
              selected={selectedIds.has(card.id)}
              onClick={() => onCardClick(card.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
