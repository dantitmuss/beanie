import { cn } from '../lib/classnames';
import type { CardInSet } from '../engine/types';

interface Props {
  cardInSet: CardInSet;
  selected?: boolean;
  onClick?: () => void;
  dragging?: boolean;
  compact?: boolean;
  'aria-label'?: string;
}

function suitColor(suit: string): string {
  return suit === '♥' || suit === '♦' ? 'text-[#DC2626]' : 'text-[#0A0A0A]';
}

export default function CardView({
  cardInSet,
  selected = false,
  onClick,
  dragging = false,
  compact = false,
  'aria-label': ariaLabel,
}: Props) {
  const { card, aceRole } = cardInSet;
  const displaySuit = card.suit;
  const isRed = displaySuit === '♥' || displaySuit === '♦';

  const w = compact ? 'w-[52px]' : 'w-[72px]';
  const h = compact ? 'h-[76px]' : 'h-[104px]';
  const rankSize = compact ? 'text-xs' : 'text-base';
  const suitSize = compact ? 'text-[24px]' : 'text-[36px]';
  const padding = compact ? 'p-1' : 'p-1.5';

  const label = ariaLabel
    ?? (aceRole
      ? `Ace representing ${aceRole.rank}${aceRole.suit}`
      : `${card.rank}${card.suit}`);

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, 'aria-pressed': selected } : {})}
      aria-label={label}
      className={cn(
        'relative flex flex-col items-center justify-between rounded-[8px] border select-none',
        'bg-white font-mono transition-all duration-100',
        w, h, padding,
        selected
          ? 'border-[#6366F1] -translate-y-2 card-shadow-selected'
          : 'border-[#E4E4E7] card-shadow',
        dragging && 'opacity-50 scale-95',
        onClick ? 'cursor-pointer hover:border-[#6366F1] hover:-translate-y-0.5' : 'cursor-default',
      )}
    >
      <span
        className={cn('self-start leading-none font-semibold', rankSize, isRed ? 'text-[#DC2626]' : 'text-[#0A0A0A]')}
      >
        {card.rank}
      </span>

      <span className={cn('leading-none', suitSize, suitColor(displaySuit))}>
        {displaySuit}
      </span>

      {aceRole && (
        <span
          className={`absolute bottom-0.5 left-0 right-0 text-center ${compact ? 'text-[9px]' : 'text-[10px]'} text-[#71717A] leading-none truncate px-0.5`}
          aria-hidden="true"
        >
          →{aceRole.rank}{aceRole.suit}
        </span>
      )}

      <span
        className={cn('self-end leading-none font-semibold rotate-180', rankSize, isRed ? 'text-[#DC2626]' : 'text-[#0A0A0A]')}
        aria-hidden="true"
      >
        {card.rank}
      </span>
    </Tag>
  );
}
