import type { AceRole, Card, CardInSet, CardSet, Rank, SetKind, Suit } from './types';

const RANK_ORDER: Exclude<Rank, 'A'>[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['♣', '♦', '♥', '♠'];

export function rankIndex(rank: Exclude<Rank, 'A'>): number {
  return RANK_ORDER.indexOf(rank);
}

function effectiveRank(c: CardInSet): Exclude<Rank, 'A'> | null {
  if (c.card.rank !== 'A') return c.card.rank as Exclude<Rank, 'A'>;
  return c.aceRole?.rank ?? null;
}

function effectiveSuit(c: CardInSet): Suit | null {
  if (c.card.rank !== 'A') return c.card.suit;
  return c.aceRole?.suit ?? null;
}

export interface ValidateResult {
  ok: boolean;
  reason?: string;
}

export function isValidSet(set: CardSet, opts: { minSize: 3 | 4 }): ValidateResult {
  const { cards, kind } = set;

  if (cards.length < opts.minSize) {
    return { ok: false, reason: `Need at least ${opts.minSize} cards` };
  }

  for (const c of cards) {
    if (c.card.rank === 'A' && !c.aceRole) {
      return { ok: false, reason: 'Ace has no assigned role' };
    }
  }

  if (kind === 'group') {
    return validateGroup(cards);
  } else {
    return validateRun(cards);
  }
}

function validateGroup(cards: CardInSet[]): ValidateResult {
  const nonAces = cards.filter((c) => c.card.rank !== 'A');
  const ranks = new Set(nonAces.map((c) => c.card.rank));
  if (ranks.size > 1) {
    return { ok: false, reason: 'Group cards must all share the same rank' };
  }

  const groupRank = nonAces.length > 0 ? nonAces[0]!.card.rank : null;

  for (const c of cards) {
    if (c.card.rank === 'A' && c.aceRole) {
      if (groupRank !== null && c.aceRole.rank !== groupRank) {
        return { ok: false, reason: `Ace role rank ${c.aceRole.rank} does not match group rank ${groupRank}` };
      }
    }
  }

  const suits = cards.map((c) => effectiveSuit(c)).filter((s): s is Suit => s !== null);
  const suitSet = new Set(suits);
  if (suitSet.size !== suits.length) {
    return { ok: false, reason: 'Duplicate suits in group' };
  }

  if (cards.length > 4) {
    return { ok: false, reason: 'Group cannot exceed 4 cards (one per suit)' };
  }

  return { ok: true };
}

function validateRun(cards: CardInSet[]): ValidateResult {
  const nonAces = cards.filter((c) => c.card.rank !== 'A');
  const suits = new Set(nonAces.map((c) => c.card.suit));
  if (suits.size > 1) {
    return { ok: false, reason: 'Run cards must all share the same suit' };
  }

  const runSuit = nonAces.length > 0 ? nonAces[0]!.card.suit : null;

  for (const c of cards) {
    if (c.card.rank === 'A' && c.aceRole) {
      if (runSuit !== null && c.aceRole.suit !== runSuit) {
        return { ok: false, reason: `Ace suit ${c.aceRole.suit} does not match run suit ${runSuit}` };
      }
    }
  }

  const effectiveRanks = cards.map((c) => effectiveRank(c));
  for (const r of effectiveRanks) {
    if (r === null) {
      return { ok: false, reason: 'Ace has no assigned role' };
    }
  }

  const indices = (effectiveRanks as Exclude<Rank, 'A'>[]).map(rankIndex);
  indices.sort((a, b) => a - b);

  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1]! + 1) {
      return { ok: false, reason: 'Run is not consecutive' };
    }
  }

  const uniqueIndices = new Set(indices);
  if (uniqueIndices.size !== indices.length) {
    return { ok: false, reason: 'Duplicate ranks in run' };
  }

  return { ok: true };
}

export interface InferResult {
  ok: boolean;
  cards?: CardInSet[];
  ambiguous?: AceRole[][];
  reason?: string;
}

export function inferAceRoles(
  cards: Card[],
  hint?: { kind: SetKind; suit?: Suit; rank?: Rank },
): InferResult {
  const aces = cards.filter((c) => c.rank === 'A');
  const nonAces = cards.filter((c) => c.rank !== 'A');

  if (aces.length === 0) {
    return {
      ok: true,
      cards: cards.map((c) => ({ card: c })),
    };
  }

  if (!hint) {
    return { ok: false, reason: 'Cannot infer Ace roles without a kind hint' };
  }

  if (hint.kind === 'group') {
    return inferGroupAceRoles(cards, nonAces, aces, hint.rank);
  } else {
    return inferRunAceRoles(cards, nonAces, aces, hint.suit);
  }
}

function inferGroupAceRoles(
  cards: Card[],
  nonAces: Card[],
  aces: Card[],
  hintRank?: Rank,
): InferResult {
  const groupRankCandidates =
    nonAces.length > 0
      ? [nonAces[0]!.rank as Exclude<Rank, 'A'>]
      : hintRank && hintRank !== 'A'
        ? [hintRank as Exclude<Rank, 'A'>]
        : null;

  if (!groupRankCandidates) {
    return { ok: false, reason: 'Cannot determine group rank from all-Ace group' };
  }

  const groupRank = groupRankCandidates[0]!;
  const usedSuits = new Set(nonAces.map((c) => c.suit));

  if (aces.length > SUITS.filter((s) => !usedSuits.has(s)).length) {
    return { ok: false, reason: 'Too many Aces for remaining suits in group' };
  }

  const availableSuits = SUITS.filter((s) => !usedSuits.has(s));

  const aceRoleAssignments: AceRole[] = [];
  for (let i = 0; i < aces.length; i++) {
    aceRoleAssignments.push({ rank: groupRank, suit: availableSuits[i]! });
  }

  const result: CardInSet[] = cards.map((c) => {
    if (c.rank !== 'A') return { card: c };
    const idx = aces.indexOf(c);
    return { card: c, aceRole: aceRoleAssignments[idx]! };
  });

  return { ok: true, cards: result };
}

function inferRunAceRoles(
  cards: Card[],
  nonAces: Card[],
  aces: Card[],
  hintSuit?: Suit,
): InferResult {
  const runSuit = nonAces.length > 0 ? nonAces[0]!.suit : hintSuit ?? null;
  if (!runSuit) {
    return { ok: false, reason: 'Cannot determine run suit' };
  }

  const nonAceRanks = nonAces.map((c) => rankIndex(c.rank as Exclude<Rank, 'A'>));

  const sortedNonAce = [...nonAceRanks].sort((a, b) => a - b);

  const minRank = sortedNonAce.length > 0 ? sortedNonAce[0]! : null;
  const maxRank = sortedNonAce.length > 0 ? sortedNonAce[sortedNonAce.length - 1]! : null;

  const possibleSequences = findRunSequences(
    sortedNonAce,
    aces.length,
    minRank,
    maxRank,
  );

  if (possibleSequences.length === 0) {
    return { ok: false, reason: 'No valid run arrangement found' };
  }

  if (possibleSequences.length > 1) {
    const ambiguous = possibleSequences.map((seq) =>
      seq
        .filter((idx) => !nonAceRanks.includes(idx))
        .map((idx): AceRole => ({ rank: RANK_ORDER[idx]!, suit: runSuit })),
    );
    return { ok: false, ambiguous };
  }

  const seq = possibleSequences[0]!;
  const aceSlots = seq.filter((idx) => !nonAceRanks.includes(idx));
  const aceRoles: AceRole[] = aceSlots.map((idx) => ({ rank: RANK_ORDER[idx]!, suit: runSuit }));

  const result: CardInSet[] = cards.map((c) => {
    if (c.rank !== 'A') return { card: c };
    const aceIdx = aces.indexOf(c);
    return { card: c, aceRole: aceRoles[aceIdx]! };
  });

  return { ok: true, cards: result };
}

function findRunSequences(
  nonAceIndices: number[],
  aceCount: number,
  minRank: number | null,
  maxRank: number | null,
): number[][] {
  const total = nonAceIndices.length + aceCount;

  const low = minRank !== null ? Math.max(0, minRank - aceCount) : 0;
  const high = maxRank !== null ? Math.min(RANK_ORDER.length - 1, maxRank + aceCount) : RANK_ORDER.length - 1;

  const results: number[][] = [];

  for (let start = low; start <= high; start++) {
    const end = start + total - 1;
    if (end >= RANK_ORDER.length) break;

    const seq: number[] = [];
    for (let i = start; i <= end; i++) seq.push(i);

    const canFit = nonAceIndices.every((idx) => seq.includes(idx));
    if (!canFit) continue;

    const gaps = seq.filter((idx) => !nonAceIndices.includes(idx));
    if (gaps.length !== aceCount) continue;

    results.push(seq);
  }

  return results;
}

export { RANK_ORDER, SUITS };
