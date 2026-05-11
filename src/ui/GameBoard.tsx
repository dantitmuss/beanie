import { useState } from 'react';
import Header from './Header';
import OpponentArea from './OpponentArea';
import PlayerArea from './PlayerArea';
import Hand from './Hand';
import DrawPile from './DrawPile';
import DiscardPile from './DiscardPile';
import ActionBar from './ActionBar';
import RulesModal from './RulesModal';
import AcePicker from './AcePicker';
import Toast from './Toast';
import RearrangeBoard from './RearrangeBoard';
import HandExpandModal from './HandExpandModal';
import { useGameStore } from '../store/gameStore';
import { inferAceRoles, isValidSet } from '../engine/sets';
import type { AceRole, CardInSet, CardSet } from '../engine/types';

export default function GameBoard() {
  const {
    state,
    dispatch,
    toast,
    toastMessage,
    dismissToast,
    selectedHandCardIds,
    toggleHandCardSelection,
    clearSelection,
    resetToTitle,
    aiRunning,
  } = useGameStore();

  const [showRules, setShowRules] = useState(false);
  const [showHandExpand, setShowHandExpand] = useState(false);
  const [acePicker, setAcePicker] = useState<{
    options: AceRole[][];
    pendingCards: CardInSet[];
    ownerId: string;
  } | null>(null);

  if (!state) return null;

  const human = state.players[0]!;
  const opponents = state.players.slice(1);
  const currentPlayerId = state.turnOrder[state.currentPlayerIdx]!;
  const isHumanTurn = currentPlayerId === human.id;
  const humanSets = state.table.filter((s) => s.ownerId === human.id);

  function handleDraw() {
    dispatch({ type: 'DRAW' });
  }

  function handleTakeDiscard() {
    dispatch({ type: 'TAKE_DISCARD' });
  }

  function handleDiscard(cardId: string) {
    if (state!.phase !== 'inTurn') return;
    dispatch({ type: 'DISCARD', cardId });
    clearSelection();
  }

  function handleHandCardClick(cardId: string) {
    if (state!.phase !== 'inTurn' || !isHumanTurn) return;
    toggleHandCardSelection(cardId);
  }

  function handlePlaySelectedAsNewSet() {
    if (!state || selectedHandCardIds.size < 3) {
      toast('Select at least 3 cards to form a set');
      return;
    }
    const selectedCards = human.hand.filter((c) => selectedHandCardIds.has(c.id));
    const kind = guessKind(selectedCards);
    const infer = inferAceRoles(selectedCards, { kind });
    if (infer.ok && infer.cards) {
      tryPlaySet(infer.cards, human.id);
    } else if (infer.ambiguous) {
      setAcePicker({
        options: infer.ambiguous,
        pendingCards: selectedCards.map((c) => ({ card: c })),
        ownerId: human.id,
      });
    } else {
      toast(infer.reason ?? 'Cannot form a valid set');
    }
  }

  function tryPlaySet(cards: CardInSet[], ownerId: string) {
    const suits = new Set(cards.filter((c) => c.card.rank !== 'A').map((c) => c.card.suit));
    const kind: CardSet['kind'] = suits.size === 1 ? 'run' : 'group';
    const tmp: CardSet = { id: 'tmp', ownerId, kind, cards };
    const minSize = human.hasOpened ? 3 : 4;
    const valid = isValidSet(tmp, { minSize });
    if (!valid.ok) {
      toast(valid.reason ?? 'Invalid set');
      return;
    }
    dispatch({ type: 'PLAY_SET', ownerId, cards });
    clearSelection();
  }

  function handleAcePickerSelect(role: AceRole) {
    if (!acePicker) return;
    const cards = acePicker.pendingCards.map((c) =>
      c.card.rank === 'A' ? { ...c, aceRole: role } : c,
    );
    setAcePicker(null);
    tryPlaySet(cards, acePicker.ownerId);
  }

  function handleDiscardSelectedCard() {
    if (selectedHandCardIds.size === 1) {
      const [cardId] = selectedHandCardIds;
      handleDiscard(cardId!);
    } else if (selectedHandCardIds.size > 1) {
      toast('Select exactly one card to discard');
    } else {
      toast('Select a card from your hand to discard');
    }
  }

  function guessKind(cards: { rank: string; suit: string }[]): 'group' | 'run' {
    const nonAces = cards.filter((c) => c.rank !== 'A');
    const suits = new Set(nonAces.map((c) => c.suit));
    return suits.size === 1 ? 'run' : 'group';
  }

  const canEndTurn = state.phase === 'inTurn' && isHumanTurn && selectedHandCardIds.size === 1;

  if (state.phase === 'rearranging') {
    return (
      <div className="flex flex-col h-screen bg-[#FAFAFA] overflow-hidden">
        <Header onRulesClick={() => setShowRules(true)} onRestartClick={resetToTitle} aiThinking={aiRunning} />
        <RearrangeBoard />
        {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#FAFAFA] overflow-hidden">
      <Header
        onRulesClick={() => setShowRules(true)}
        onRestartClick={resetToTitle}
        aiThinking={aiRunning}
      />

      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
        {/* Opponents */}
        <div className="border-b border-[#E4E4E7] bg-white px-4 py-3">
          <div className="flex flex-row gap-6 overflow-x-auto">
            {opponents.map((opp) => {
              const oppSets = state.table.filter((s) => s.ownerId === opp.id);
              return (
                <div key={opp.id} className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {currentPlayerId === opp.id && (
                      <span className="w-2 h-2 rounded-full bg-[#6366F1] shrink-0" aria-label="Current turn" />
                    )}
                    <span className="text-xs font-medium text-[#71717A]">{opp.name}</span>
                  </div>
                  <OpponentArea player={opp} sets={oppSets} compact />
                </div>
              );
            })}
          </div>
        </div>

        {/* Centre piles */}
        <div className="relative flex flex-row items-center justify-center gap-8 py-6 border-b border-[#E4E4E7]">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-[#71717A] font-medium mb-1">Draw</span>
            <DrawPile
              count={state.drawPile.length}
              onClick={handleDraw}
              disabled={state.phase !== 'awaitingDraw' || !isHumanTurn}
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-[#71717A] font-medium mb-1">Discard</span>
            <DiscardPile
              topCard={state.discardPile[0] ?? null}
              pile={state.discardPile}
              onClick={handleTakeDiscard}
              disabled={state.phase !== 'awaitingDraw' || !isHumanTurn || state.discardPile.length === 0}
            />
          </div>

          {!isHumanTurn && state.phase !== 'gameOver' && (
            <span className="absolute right-4 bottom-2 text-xs text-[#71717A] italic">
              {state.players.find((p) => p.id === currentPlayerId)?.name}…
            </span>
          )}
        </div>

        {/* Player sets */}
        <PlayerArea
          sets={humanSets}
          selectedCardIds={selectedHandCardIds}
          onCardClick={undefined}
          onNewSetDrop={handlePlaySelectedAsNewSet}
        />
      </div>

      {/* Hand */}
      <div className="shrink-0 border-t border-[#E4E4E7] bg-white">
        <div className="px-4 pt-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
            Your hand
            {isHumanTurn && <span className="ml-2 text-[#6366F1]">● your turn</span>}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#71717A]">{human.hand.length} cards</span>
            <button
              type="button"
              onClick={() => setShowHandExpand(true)}
              className="text-[#71717A] hover:text-[#0A0A0A] text-base leading-none"
              aria-label="Expand hand view"
            >
              ⤢
            </button>
          </div>
        </div>
        <Hand
          cards={human.hand}
          selectedIds={selectedHandCardIds}
          onCardClick={handleHandCardClick}
        />
        {selectedHandCardIds.size > 0 && state.phase === 'inTurn' && isHumanTurn && (
          <div className="px-4 pb-2 flex gap-2">
            <button
              type="button"
              onClick={handlePlaySelectedAsNewSet}
              disabled={selectedHandCardIds.size < 3}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#6366F1] text-white disabled:opacity-40 font-medium"
            >
              Play as set ({selectedHandCardIds.size})
            </button>
            <button
              type="button"
              onClick={handleDiscardSelectedCard}
              disabled={selectedHandCardIds.size !== 1}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#E4E4E7] text-[#0A0A0A] disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs px-3 py-1.5 rounded-lg text-[#71717A] hover:text-[#0A0A0A]"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <ActionBar
        phase={state.phase}
        canTakeDiscard={state.discardPile.length > 0 && isHumanTurn}
        canEndTurn={canEndTurn}
        canRearrange={human.hasOpened && state.phase === 'inTurn' && isHumanTurn}
        onDraw={handleDraw}
        onTakeDiscard={handleTakeDiscard}
        onEndTurn={handleDiscardSelectedCard}
        onRearrange={() => dispatch({ type: 'START_REARRANGE' })}
      />

      {toastMessage && <Toast message={toastMessage} onDismiss={dismissToast} />}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showHandExpand && (
        <HandExpandModal
          cards={human.hand}
          selectedIds={selectedHandCardIds}
          onCardClick={handleHandCardClick}
          onClose={() => setShowHandExpand(false)}
        />
      )}
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
