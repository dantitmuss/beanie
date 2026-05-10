import CardBack from './CardBack';

interface Props {
  count: number;
  onClick?: () => void;
  disabled?: boolean;
}

export default function DrawPile({ count, onClick, disabled = false }: Props) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || count === 0}
        aria-label={`Draw pile, ${count} cards remaining`}
        className="relative disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] rounded-[8px]"
      >
        {count > 0 ? (
          <div className="relative">
            {count > 2 && (
              <div className="absolute top-0.5 left-0.5">
                <CardBack />
              </div>
            )}
            {count > 1 && (
              <div className="absolute top-0.5 left-0">
                <CardBack />
              </div>
            )}
            <div className="relative">
              <CardBack />
            </div>
          </div>
        ) : (
          <div className="w-14 h-20 rounded-[8px] border-2 border-dashed border-[#E4E4E7] flex items-center justify-center">
            <span className="text-[#71717A] text-xs">Empty</span>
          </div>
        )}
      </button>
      <span className="text-xs text-[#71717A]">{count}</span>
    </div>
  );
}
