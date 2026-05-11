import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CardView from './CardView';
import type { Card } from '../engine/types';

interface Props {
  card: Card;
  selected: boolean;
  onCardClick?: (cardId: string) => void;
}

export default function SortableHandCard({ card, selected, onCardClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} role="listitem" className="flex flex-col items-center gap-0.5">
      <CardView
        cardInSet={{ card }}
        selected={selected}
        onClick={onCardClick ? () => onCardClick(card.id) : undefined}
        dragging={isDragging}
        aria-label={`${card.rank}${card.suit}, in hand`}
      />
      <div
        {...listeners}
        style={{ touchAction: 'none' }}
        aria-label="Drag to reorder"
        className="w-full flex justify-center items-center h-4 rounded-b cursor-grab active:cursor-grabbing"
      >
        <div className="flex gap-[3px]">
          <span className="block w-[3px] h-[3px] rounded-full bg-[#D4D4D8]" />
          <span className="block w-[3px] h-[3px] rounded-full bg-[#D4D4D8]" />
          <span className="block w-[3px] h-[3px] rounded-full bg-[#D4D4D8]" />
          <span className="block w-[3px] h-[3px] rounded-full bg-[#D4D4D8]" />
          <span className="block w-[3px] h-[3px] rounded-full bg-[#D4D4D8]" />
        </div>
      </div>
    </div>
  );
}
