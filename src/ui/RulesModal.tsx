interface Props {
  onClose: () => void;
}

export default function RulesModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E4E7]">
          <h2 id="rules-title" className="text-lg font-semibold text-[#0A0A0A]">
            How to play
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#0A0A0A]"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 text-sm text-[#0A0A0A] space-y-4 leading-relaxed">
          <section>
            <h3 className="font-semibold mb-1">Aim</h3>
            <p>Get rid of all your cards. Place them in sets on the table, then end your turn by discarding one card.</p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Starting a turn</h3>
            <p>Take <strong>one card</strong> from the draw pile, or take <strong>all cards</strong> from the discard pile.</p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Sets</h3>
            <ul className="list-disc list-inside space-y-1 text-[#71717A]">
              <li><strong className="text-[#0A0A0A]">Group:</strong> 3–4 cards of the same rank, one per suit (e.g. 7♣ 7♥ 7♠).</li>
              <li><strong className="text-[#0A0A0A]">Run:</strong> 3+ consecutive cards of the same suit (e.g. 4♥ 5♥ 6♥). No wrapping.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Opening set</h3>
            <p>Your <strong>first set</strong> must contain at least <strong>4 cards</strong>. After that, sets need only 3.</p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Aces are wild</h3>
            <ul className="list-disc list-inside space-y-1 text-[#71717A]">
              <li>An Ace can represent any rank (2–K) and any suit.</li>
              <li>An Ace <strong className="text-[#0A0A0A]">cannot</strong> represent a 1 or another Ace.</li>
              <li>You can replace an Ace in a table set with the real card from your hand, freeing the Ace.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Rearranging</h3>
            <p>Once you've opened, you can rearrange any sets on the table. Every card must remain in a valid set; each player who had a 4-card set before your turn must still have one after.</p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Winning</h3>
            <p>Play all your cards into sets, then discard your last card. That ends the game.</p>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-[#E4E4E7]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-[#6366F1] text-white rounded-lg text-sm font-medium hover:bg-[#4F46E5] transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
