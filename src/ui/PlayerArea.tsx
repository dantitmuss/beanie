import TableSet from './TableSet';
import type { CardSet } from '../engine/types';
import { cn } from '../lib/classnames';

interface Props {
  sets: CardSet[];
  onNewSetDrop?: () => void;
  selectedCardIds?: Set<string>;
  onCardClick?: (cardId: string) => void;
  rearrangeMode?: boolean;
}

export default function PlayerArea({
  sets,
  onNewSetDrop,
  selectedCardIds,
  onCardClick,
  rearrangeMode = false,
}: Props) {
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide">Your sets</span>
      <div className="flex flex-row flex-wrap gap-3 min-h-[88px] items-start">
        {sets.map((set) => (
          <TableSet
            key={set.id}
            set={set}
            selectedCardIds={selectedCardIds}
            onCardClick={onCardClick}
            compact={false}
          />
        ))}

        <button
          type="button"
          onClick={onNewSetDrop}
          aria-label="Create new set from selected cards"
          className={cn(
            'w-14 h-20 rounded-[8px] border-2 border-dashed flex items-center justify-center',
            'text-[#71717A] text-xl',
            rearrangeMode ? 'border-[#6366F1] text-[#6366F1]' : 'border-[#E4E4E7]',
            'hover:border-[#6366F1] hover:text-[#6366F1] transition-colors',
          )}
        >
          +
        </button>
      </div>
    </div>
  );
}
