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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import SortableHandCard from './SortableHandCard';
import type { Card } from '../engine/types';
import { useGameStore } from '../store/gameStore';

interface Props {
  cards: Card[];
  selectedIds: Set<string>;
  onCardClick: (cardId: string) => void;
  onClose: () => void;
}

export default function HandExpandModal({ cards, selectedIds, onCardClick, onClose }: Props) {
  const { handOrder, reorderHand } = useGameStore();

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
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
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

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedCards.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div
              className="flex flex-row flex-wrap gap-2 overflow-y-auto"
              role="list"
              aria-label="Your hand"
            >
              {orderedCards.map((card) => (
                <SortableHandCard
                  key={card.id}
                  card={card}
                  selected={selectedIds.has(card.id)}
                  onCardClick={onCardClick}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
