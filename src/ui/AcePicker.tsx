import type { AceRole } from '../engine/types';
import { cn } from '../lib/classnames';

interface Props {
  options: AceRole[][];
  onSelect: (roles: AceRole[]) => void;
  onCancel: () => void;
}

function roleLabel(roles: AceRole[]): string {
  return roles.map((r) => `${r.rank}${r.suit}`).join(' + ');
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
          {options[0]?.length === 1 ? 'What does this Ace represent?' : 'What do the Aces represent?'}
        </h2>

        <div className="grid grid-cols-2 gap-2">
          {options.map((roles) => {
            const isRed = roles.every((r) => r.suit === '♥' || r.suit === '♦');
            return (
              <button
                key={roleLabel(roles)}
                type="button"
                onClick={() => onSelect(roles)}
                className={cn(
                  'py-3 rounded-lg border border-[#E4E4E7] font-mono font-semibold text-lg',
                  'hover:border-[#6366F1] hover:bg-[#EEF2FF] transition-colors',
                  isRed ? 'text-[#DC2626]' : 'text-[#0A0A0A]',
                )}
              >
                {roleLabel(roles)}
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
