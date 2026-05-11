import { useEffect } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CardView from './CardView';
import type { Card } from '../engine/types';
import { cn } from '../lib/classnames';
import { useGameStore } from '../store/gameStore';

interface SortableCardProps {
  card: Card;
  selected: boolean;
  onCardClick?: (cardId: string) => void;
}

function SortableCard({ card, selected, onCardClick }: SortableCardProps) {
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

interface Props {
  cards: Card[];
  selectedIds?: Set<string>;
  onCardClick?: (cardId: string) => void;
}

export default function Hand({ cards, selectedIds, onCardClick }: Props) {
  const { handOrder, reorderHand, reconcileHandOrder } = useGameStore();

  useEffect(() => {
    reconcileHandOrder(cards);
  }, [cards, reconcileHandOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const orderedCards = handOrder
    .map((id) => cards.find((c) => c.id === id))
    .filter((c): c is Card => c !== undefined);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderHand(String(active.id), String(over.id));
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedCards.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
        <div
          className="flex flex-row items-end gap-2 overflow-x-auto px-4 py-2 min-h-[120px]"
          role="list"
          aria-label="Your hand"
        >
          {orderedCards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              selected={selectedIds?.has(card.id) ?? false}
              onCardClick={onCardClick}
            />
          ))}
          {cards.length === 0 && (
            <span className={cn('text-sm text-[#71717A] self-center')}>No cards in hand</span>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
