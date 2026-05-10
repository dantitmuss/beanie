import { cn } from '../lib/classnames';

export type GamePhase = 'awaitingDraw' | 'inTurn' | 'rearranging' | 'gameOver';

interface Props {
  phase: GamePhase;
  canTakeDiscard: boolean;
  canEndTurn: boolean;
  canRearrange: boolean;
  onDraw?: () => void;
  onTakeDiscard?: () => void;
  onEndTurn?: () => void;
  onRearrange?: () => void;
  onCancelRearrange?: () => void;
  onConfirmRearrange?: () => void;
  rearrangeErrors?: string[];
}

function Btn({
  label,
  onClick,
  disabled,
  primary,
  danger,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        primary && 'bg-[#6366F1] text-white hover:bg-[#4F46E5]',
        danger && 'bg-white text-[#DC2626] border border-[#DC2626] hover:bg-red-50',
        !primary && !danger && 'bg-white text-[#0A0A0A] border border-[#E4E4E7] hover:bg-[#F4F4F5]',
      )}
    >
      {label}
    </button>
  );
}

export default function ActionBar({
  phase,
  canTakeDiscard,
  canEndTurn,
  canRearrange,
  onDraw,
  onTakeDiscard,
  onEndTurn,
  onRearrange,
  onCancelRearrange,
  onConfirmRearrange,
  rearrangeErrors = [],
}: Props) {
  return (
    <div
      className={cn(
        'shrink-0 border-t border-[#E4E4E7] bg-white px-4 py-3',
        'flex items-center gap-2 flex-wrap',
      )}
      role="toolbar"
      aria-label="Game actions"
    >
      {phase === 'awaitingDraw' && (
        <>
          <Btn label="Draw" onClick={onDraw} primary />
          <Btn label="Take discard pile" onClick={onTakeDiscard} disabled={!canTakeDiscard} />
        </>
      )}

      {phase === 'inTurn' && (
        <>
          <Btn label="End turn" onClick={onEndTurn} disabled={!canEndTurn} primary />
          <Btn label="Rearrange" onClick={onRearrange} disabled={!canRearrange} />
        </>
      )}

      {phase === 'rearranging' && (
        <>
          <Btn label="Cancel" onClick={onCancelRearrange} danger />
          <div className="flex items-center gap-2 ml-auto">
            {rearrangeErrors.length > 0 && (
              <span className="text-xs text-[#DC2626] max-w-[200px] truncate" title={rearrangeErrors.join('; ')}>
                {rearrangeErrors[0]}
              </span>
            )}
            <Btn
              label="Confirm rearrange"
              onClick={onConfirmRearrange}
              disabled={rearrangeErrors.length > 0}
              primary
            />
          </div>
        </>
      )}
    </div>
  );
}
