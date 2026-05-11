import CardBack from './CardBack';
import TableSet from './TableSet';
import type { CardSet, Player } from '../engine/types';

interface Props {
  player: Player;
  sets: CardSet[];
  compact?: boolean;
}

export default function OpponentArea({ player, sets, compact = false }: Props) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex flex-row items-center gap-2 px-1">
        <span className="text-xs font-medium text-[#71717A] truncate">{player.name}</span>
        {player.hasOpened && (
          <span className="text-[10px] bg-[#E4E4E7] text-[#71717A] rounded px-1 py-0.5 whitespace-nowrap">
            opened
          </span>
        )}
        <span className="text-xs text-[#71717A] ml-auto whitespace-nowrap">
          {player.hand.length} cards
        </span>
      </div>

      <div className="flex flex-row gap-2 items-end min-h-[64px] overflow-x-auto">
        {player.hand.length > 0 && (
          <div className="flex flex-row shrink-0 items-end gap-1">
            <div className="flex flex-row -space-x-4">
              {Array.from({ length: Math.min(player.hand.length, 5) }).map((_, i) => (
                <div key={i} style={{ zIndex: i }}>
                  <CardBack compact={compact} />
                </div>
              ))}
            </div>
            {player.hand.length > 5 && (
              <div
                className="w-8 h-10 shrink-0 rounded-[6px] bg-[#E4E4E7] flex items-center justify-center text-xs text-[#71717A] font-medium"
                aria-label={`${player.hand.length - 5} more cards`}
              >
                +{player.hand.length - 5}
              </div>
            )}
          </div>
        )}

        {sets.map((set) => (
          <TableSet key={set.id} set={set} compact />
        ))}
      </div>
    </div>
  );
}
