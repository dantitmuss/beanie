import type { AceRole } from '../engine/types';
import { cn } from '../lib/classnames';

interface Props {
  options: AceRole[];
  onSelect: (role: AceRole) => void;
  onCancel: () => void;
}

export default function AcePicker({ options, onSelect, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ace-picker-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-xs w-full p-6 flex flex-col gap-4">
        <h2 id="ace-picker-title" className="text-base font-semibold text-[#0A0A0A] text-center">
          What does this Ace represent?
        </h2>

        <div className="grid grid-cols-2 gap-2">
          {options.map((role) => {
            const isRed = role.suit === '♥' || role.suit === '♦';
            return (
              <button
                key={`${role.rank}${role.suit}`}
                type="button"
                onClick={() => onSelect(role)}
                className={cn(
                  'py-3 rounded-lg border border-[#E4E4E7] font-mono font-semibold text-lg',
                  'hover:border-[#6366F1] hover:bg-[#EEF2FF] transition-colors',
                  isRed ? 'text-[#DC2626]' : 'text-[#0A0A0A]',
                )}
              >
                {role.rank}{role.suit}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[#71717A] hover:text-[#0A0A0A] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
