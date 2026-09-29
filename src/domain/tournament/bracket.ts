/**
 * Single-elimination bracket generation (spec §22, §23). Pure and deterministic.
 *
 * Seeding: participants sorted by rating desc (unrated last), ties broken by a stable hash of
 * (tournamentId, playerId). Seeds are placed in standard order (1 vs N, 2 vs N-1, ...), so byes —
 * which are the "missing" bottom seeds — go to the top seeds.
 *
 * Rounds are numbered from 1 (first round) to log2(size) (final). Match (r, p) feeds into
 * (r + 1, ceil(p / 2)), slot 1 if p is odd, slot 2 otherwise. Bye matches in round 1 are not
 * created; the advancing player is pre-placed into their round-2 slot.
 */
import type { RatingStatus } from "../rating/engine";

export type Entrant = {
  playerId: string;
  rating: number | null;
  ratingStatus: RatingStatus;
};

export type SeededEntrant = Entrant & { seed: number };

export type BracketMatch = {
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
};

export type Bracket = {
  size: number;
  rounds: number;
  seeds: SeededEntrant[];
  matches: BracketMatch[];
  byes: string[]; // player ids that skip round 1
};

export class BracketError extends Error {}

/** FNV-1a 32-bit — stable across runtimes, good enough for tie-breaking. */
export function stableHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function nextPowerOfTwo(n: number): number {
  let s = 1;
  while (s < n) s <<= 1;
  return s;
}

/**
 * Standard seed placement for a bracket of `size` slots, e.g. size 8 → [1,8,4,5,2,7,3,6].
 * Adjacent pairs form round-1 matches; the strongest seeds land in opposite halves.
 */
export function seedOrder(size: number): number[] {
  if (size < 1 || (size & (size - 1)) !== 0) throw new BracketError("size must be a power of two");
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) next.push(s, n + 1 - s);
    order = next;
  }
  return order;
}

export function seedEntrants(entrants: Entrant[], tournamentId: string): SeededEntrant[] {
  const ids = new Set(entrants.map((e) => e.playerId));
  if (ids.size !== entrants.length) throw new BracketError("duplicate entrant");
  return [...entrants]
    .sort((a, b) => {
      const ra = a.rating ?? -Infinity;
      const rb = b.rating ?? -Infinity;
      if (rb !== ra) return rb - ra;
      return stableHash(tournamentId + a.playerId) - stableHash(tournamentId + b.playerId);
    })
    .map((e, i) => ({ ...e, seed: i + 1 }));
}

export function generateBracket(entrants: Entrant[], tournamentId: string): Bracket {
  if (entrants.length < 2) throw new BracketError("at least 2 entrants required");
  const seeds = seedEntrants(entrants, tournamentId);
  const size = nextPowerOfTwo(seeds.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const bySeed = new Map(seeds.map((s) => [s.seed, s.playerId]));

  // Slot i holds seed order[i]; seeds beyond the entrant count are byes.
  const slots: (string | null)[] = order.map((s) => bySeed.get(s) ?? null);

  const matches: BracketMatch[] = [];
  const byes: string[] = [];
  const round2Slots = new Map<string, string>(); // "position:slot" → playerId

  // Round 1
  for (let p = 1; p <= size / 2; p++) {
    const a = slots[2 * p - 2];
    const b = slots[2 * p - 1];
    if (a && b) {
      matches.push({ round: 1, position: p, player1Id: a, player2Id: b });
    } else {
      const adv = a ?? b;
      if (!adv) throw new BracketError("two byes met — invalid bracket size");
      byes.push(adv);
      round2Slots.set(`${Math.ceil(p / 2)}:${p % 2 === 1 ? 1 : 2}`, adv);
    }
  }

  // Later rounds (empty slots, except byes advancing into round 2)
  for (let r = 2; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let p = 1; p <= count; p++) {
      matches.push({
        round: r,
        position: p,
        player1Id: r === 2 ? (round2Slots.get(`${p}:1`) ?? null) : null,
        player2Id: r === 2 ? (round2Slots.get(`${p}:2`) ?? null) : null,
      });
    }
  }

  return { size, rounds, seeds, matches, byes };
}

export const ROUND_NAMES: Record<number, string> = { 1: "Финал", 2: "1/2", 3: "1/4", 4: "1/8", 5: "1/16", 6: "1/32" };

/** Human label for a round given total rounds: last round = "Финал", previous = "1/2", ... */
export function roundLabel(round: number, rounds: number): string {
  return ROUND_NAMES[rounds - round + 1] ?? `Раунд ${round}`;
}
