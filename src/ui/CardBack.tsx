import BeanieLogo from './BeanieLogo';
import { cn } from '../lib/classnames';

interface Props {
  compact?: boolean;
}

export default function CardBack({ compact = false }: Props) {
  const w = compact ? 'w-10' : 'w-14';
  const h = compact ? 'h-14' : 'h-20';
  return (
    <div
      className={cn(
        'rounded-[8px] bg-[#6366F1] flex items-center justify-center',
        w, h,
      )}
      aria-hidden="true"
    >
      <BeanieLogo size={compact ? 16 : 20} variant="light" />
    </div>
  );
}
