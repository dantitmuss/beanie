import CardView from './CardView';
import type { Card } from '../engine/types';
import { cn } from '../lib/classnames';

interface Props {
  cards: Card[];
  selectedIds?: Set<string>;
  onCardClick?: (cardId: string) => void;
  onCardDragStart?: (cardId: string) => void;
}

export default function Hand({ cards, selectedIds, onCardClick }: Props) {
  return (
    <div
      className="flex flex-row items-end gap-2 overflow-x-auto px-4 py-2 min-h-[120px]"
      role="list"
      aria-label="Your hand"
    >
      {cards.map((card) => (
        <div key={card.id} role="listitem">
          <CardView
            cardInSet={{ card }}
            selected={selectedIds?.has(card.id)}
            onClick={onCardClick ? () => onCardClick(card.id) : undefined}
            aria-label={`${card.rank}${card.suit}, in hand`}
          />
        </div>
      ))}
      {cards.length === 0 && (
        <span className={cn('text-sm text-[#71717A] self-center')}>No cards in hand</span>
      )}
    </div>
  );
}
