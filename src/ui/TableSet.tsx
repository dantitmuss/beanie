import CardView from './CardView';
import type { CardSet, Rank } from '../engine/types';
import { rankIndex } from '../engine/sets';
import { cn } from '../lib/classnames';

function effectiveRankIndex(c: CardSet['cards'][number]): number {
  if (c.card.rank !== 'A') return rankIndex(c.card.rank as Exclude<Rank, 'A'>);
  return c.aceRole ? rankIndex(c.aceRole.rank) : -1;
}

interface Props {
  set: CardSet;
  compact?: boolean;
  validationBadge?: 'ok' | 'error' | null;
  validationMessage?: string;
  onCardClick?: (cardId: string) => void;
  selectedCardIds?: Set<string>;
}

export default function TableSet({
  set,
  compact = false,
  validationBadge = null,
  validationMessage,
  onCardClick,
  selectedCardIds,
}: Props) {
  return (
    <div className="relative flex flex-col gap-1">
      <div
        className={cn(
          'flex flex-row items-end gap-1 rounded-[8px] p-1.5 border',
          validationBadge === 'error'
            ? 'border-[#DC2626] bg-red-50'
            : validationBadge === 'ok'
              ? 'border-[#16A34A] bg-green-50'
              : 'border-[#E4E4E7] bg-white',
          'overflow-x-auto max-w-[240px] min-w-0',
        )}
        role="group"
        aria-label={`${set.kind} set with ${set.cards.length} cards`}
      >
        {(set.kind === 'run' ? [...set.cards].sort((a, b) => effectiveRankIndex(a) - effectiveRankIndex(b)) : set.cards).map((c) => (
          <CardView
            key={c.card.id}
            cardInSet={c}
            compact={compact}
            selected={selectedCardIds?.has(c.card.id)}
            onClick={onCardClick ? () => onCardClick(c.card.id) : undefined}
          />
        ))}
      </div>

      {validationBadge && (
        <div
          className={cn(
            'absolute -top-2 -right-2 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white',
            validationBadge === 'ok' ? 'bg-[#16A34A]' : 'bg-[#DC2626]',
          )}
          title={validationMessage}
          aria-label={validationBadge === 'ok' ? 'Valid set' : `Invalid: ${validationMessage}`}
        >
          {validationBadge === 'ok' ? '✓' : '✗'}
        </div>
      )}
    </div>
  );
}
