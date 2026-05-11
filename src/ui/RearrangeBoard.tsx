import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useRearrangeStore } from '../store/rearrangeStore';
import { isValidSet } from '../engine/sets';
import type { CardSet, CardInSet } from '../engine/types';
import CardView from './CardView';
import { cn } from '../lib/classnames';
import { inferAceRoles } from '../engine/sets';
import AcePicker from './AcePicker';
import type { AceRole } from '../engine/types';

export default function RearrangeBoard() {
  const { state, dispatch, toast, clearSelection } = useGameStore();
  const {
    workingTable,
    workingHand,
    initRearrange,
    moveCardToSet,
    moveCardToHand,
    createSetFromHand,
    updateSetCards,
    getValidationErrors,
    buildCommitPayload,
  } = useRearrangeStore();

  const [selectedHandIds, setSelectedHandIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<string[]>([]);
  const [acePicker, setAcePicker] = useState<{
    options: AceRole[][];
    pendingCards: CardInSet[];
    targetSetId: string | 'new';
    targetOwnerId: string;
  } | null>(null);

  useEffect(() => {
    if (state?.phase === 'rearranging' && state.rearrangeSnapshot) {
      initRearrange(state.rearrangeSnapshot);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase]);

  useEffect(() => {
    if (!state || state.phase !== 'rearranging') return;
    const snapshot = state.rearrangeSnapshot!;
    const errs = getValidationErrors(snapshot, state.players[0]!.id);
    setErrors(errs);
  }, [workingTable, workingHand, state, getValidationErrors]);

  if (!state || state.phase !== 'rearranging') return null;

  const human = state.players[0]!;
  const snapshot = state.rearrangeSnapshot!;

  function toggleHandCard(cardId: string) {
    setSelectedHandIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function handleSetCardClick(cardId: string, fromSetId: string) {
    moveCardToHand(cardId, fromSetId);
    setSelectedHandIds(new Set());
  }

  function handleAddToSet(targetSetId: string | 'new', ownerId?: string) {
    if (selectedHandIds.size === 0) {
      toast('Select cards from your hand first');
      return;
    }
    const cards = workingHand.filter((c) => selectedHandIds.has(c.id));
    const resolvedOwnerId = ownerId ?? human.id;

    if (targetSetId !== 'new') {
      const targetSet = workingTable.find((s) => s.id === targetSetId);
      if (!targetSet) return;
      const existingCards = targetSet.cards.map((ci) => ci.card);
      const allCards = [...existingCards, ...cards];
      const hasAce = allCards.some((c) => c.rank === 'A');
      if (hasAce) {
        const kind = guessKind(allCards);
        const infer = inferAceRoles(allCards, { kind, suit: existingCards[0]?.suit });
        if (infer.ambiguous) {
          setAcePicker({
            options: infer.ambiguous,
            pendingCards: cards.map((c) => ({ card: c })),
            targetSetId,
            targetOwnerId: resolvedOwnerId,
          });
          return;
        }
        if (infer.ok && infer.cards) {
          updateSetCards(targetSetId, infer.cards, cards.map((c) => c.id));
          setSelectedHandIds(new Set());
          return;
        }
      }
      for (const card of cards) {
        moveCardToSet(card.id, targetSetId, 'hand');
      }
    } else {
      const hasAce = cards.some((c) => c.rank === 'A');
      if (hasAce) {
        const kind = guessKind(cards);
        const infer = inferAceRoles(cards, { kind });
        if (infer.ambiguous) {
          setAcePicker({
            options: infer.ambiguous,
            pendingCards: cards.map((c) => ({ card: c })),
            targetSetId: 'new',
            targetOwnerId: resolvedOwnerId,
          });
          return;
        }
        if (infer.ok && infer.cards) {
          createSetFromHand(infer.cards, resolvedOwnerId);
          setSelectedHandIds(new Set());
          return;
        }
      }
      createSetFromHand(cards.map((c) => ({ card: c })), resolvedOwnerId);
    }

    setSelectedHandIds(new Set());
  }

  function handleAcePickerSelect(role: AceRole) {
    if (!acePicker) return;
    setAcePicker(null);

    if (acePicker.targetSetId === 'new') {
      const cardsWithRole = acePicker.pendingCards.map((c) =>
        c.card.rank === 'A' ? { ...c, aceRole: role } : c,
      );
      createSetFromHand(cardsWithRole, acePicker.targetOwnerId);
    } else {
      const pendingWithRole = acePicker.pendingCards.map((c) =>
        c.card.rank === 'A' ? { ...c, aceRole: role } : c,
      );
      const targetSet = workingTable.find((s) => s.id === acePicker.targetSetId);
      if (!targetSet) return;
      updateSetCards(
        acePicker.targetSetId,
        [...targetSet.cards, ...pendingWithRole],
        acePicker.pendingCards.map((c) => c.card.id),
      );
    }
    setSelectedHandIds(new Set());
  }

  function guessKind(cards: { rank: string; suit: string }[]): 'group' | 'run' {
    const nonAces = cards.filter((c) => c.rank !== 'A');
    const suits = new Set(nonAces.map((c) => c.suit));
    return suits.size === 1 ? 'run' : 'group';
  }

  function getSetBadge(set: CardSet): { badge: 'ok' | 'error'; msg: string } {
    const r = isValidSet(set, { minSize: 3 });
    return r.ok
      ? { badge: 'ok', msg: 'Valid' }
      : { badge: 'error', msg: r.reason ?? 'Invalid set' };
  }

  function hasOpeningSet(playerId: string): boolean {
    return workingTable.some((s) => s.ownerId === playerId && s.cards.length >= 4);
  }

  function hadOpeningSetBefore(playerId: string): boolean {
    return snapshot.players.find((p) => p.id === playerId)?.hasOpened ?? false;
  }

  function handleCommit() {
    const { nextTable, nextHand } = buildCommitPayload();
    dispatch({ type: 'COMMIT_REARRANGE', nextTable, nextHand });
    clearSelection();
  }

  function handleCancel() {
    dispatch({ type: 'CANCEL_REARRANGE' });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Rearrange banner */}
      <div className="shrink-0 bg-[#EEF2FF] border-b border-[#6366F1]/30 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#6366F1]">
          Rearrange mode — click cards to move them
        </span>
        <span className="text-xs text-[#6366F1]">
          {errors.length === 0 ? '✓ All sets valid' : `${errors.length} error${errors.length > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {/* All player areas */}
        {state.players.map((player) => {
          const playerSets = workingTable.filter((s) => s.ownerId === player.id);
          const hadOpened = hadOpeningSetBefore(player.id);
          const hasOpened = hasOpeningSet(player.id);
          const openingMissing = hadOpened && !hasOpened;

          return (
            <div key={player.id} className={cn(
              'rounded-xl p-3 border',
              openingMissing ? 'border-[#DC2626] bg-red-50' : 'border-[#E4E4E7] bg-white',
            )}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-[#0A0A0A]">
                  {player.id === human.id ? 'Your sets' : player.name}
                </span>
                {hadOpened && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium',
                    hasOpened
                      ? 'bg-[#E4E4E7] text-[#71717A]'
                      : 'bg-[#DC2626] text-white',
                  )}>
                    {hasOpened ? 'opening ✓' : 'opening set required!'}
                  </span>
                )}
              </div>

              <div className="flex flex-row flex-wrap gap-3">
                {playerSets.map((set) => {
                  const { badge, msg } = getSetBadge(set);
                  return (
                    <div key={set.id} className="relative flex flex-col gap-1">
                      <div className={cn(
                        'flex flex-row items-end gap-1 rounded-lg p-1.5 border',
                        badge === 'ok' ? 'border-[#16A34A]/40' : 'border-[#DC2626]/40',
                      )}>
                        {set.cards.map((ci) => (
                          <button
                            key={ci.card.id}
                            type="button"
                            onClick={() => handleSetCardClick(ci.card.id, set.id)}
                            title="Click to return to hand"
                            className="hover:opacity-60 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] rounded-[8px]"
                          >
                            <CardView cardInSet={ci} compact />
                          </button>
                        ))}

                        {/* Drop target: add selected hand cards to this set */}
                        {selectedHandIds.size > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAddToSet(set.id)}
                            className="w-8 h-[76px] border-2 border-dashed border-[#6366F1] rounded-lg flex items-center justify-center text-[#6366F1] text-xs hover:bg-[#EEF2FF]"
                            title="Add selected cards here"
                          >
                            +
                          </button>
                        )}
                      </div>

                      <div className={cn(
                        'absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white',
                        badge === 'ok' ? 'bg-[#16A34A]' : 'bg-[#DC2626]',
                      )} title={msg}>
                        {badge === 'ok' ? '✓' : '✗'}
                      </div>
                    </div>
                  );
                })}

                {/* New set drop target */}
                {selectedHandIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAddToSet('new', player.id)}
                    className="w-[52px] h-[76px] border-2 border-dashed border-[#6366F1] rounded-lg flex items-center justify-center text-[#6366F1] text-xl hover:bg-[#EEF2FF]"
                    title={player.id === human.id ? 'Create new set from selected cards' : `Create new set for ${player.name}`}
                  >
                    +
                  </button>
                )}

                {playerSets.length === 0 && player.id !== human.id && (
                  <span className="text-xs text-[#71717A] self-center">No sets</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Working hand */}
      <div className="shrink-0 border-t border-[#E4E4E7] bg-white px-4 pt-2 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
            Hand {workingHand.length > 0 && `(${workingHand.length} — click to select)`}
          </span>
          {selectedHandIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedHandIds(new Set())}
              className="text-xs text-[#71717A] hover:text-[#0A0A0A]"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-row gap-2 overflow-x-auto pb-2 min-h-[90px]">
          {workingHand.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => toggleHandCard(card.id)}
              className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] rounded-[8px]"
            >
              <CardView
                cardInSet={{ card }}
                compact
                selected={selectedHandIds.has(card.id)}
              />
            </button>
          ))}
          {workingHand.length === 0 && (
            <span className="text-xs text-[#71717A] self-center">Hand is empty</span>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="shrink-0 border-t border-[#E4E4E7] bg-white px-4 py-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[#DC2626] border border-[#DC2626] bg-white hover:bg-red-50"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3 ml-auto">
          {errors.length > 0 && (
            <span
              className="text-xs text-[#DC2626] max-w-[200px] truncate"
              title={errors.join('; ')}
            >
              {errors[0]}
            </span>
          )}
          <button
            type="button"
            onClick={handleCommit}
            disabled={errors.length > 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#6366F1] text-white hover:bg-[#4F46E5] disabled:opacity-40 disabled:cursor-not-allowed"
            title={errors.length > 0 ? errors.join('; ') : undefined}
          >
            Confirm rearrange
          </button>
        </div>
      </div>

      {acePicker && (
        <AcePicker
          options={acePicker.options.map((opts) => opts[0]!)}
          onSelect={handleAcePickerSelect}
          onCancel={() => setAcePicker(null)}
        />
      )}
    </div>
  );
}
