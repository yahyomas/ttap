/**
 * Rating engine — pure, deterministic, no I/O (spec §41, §42).
 *
 * Formula (spec §10.2):  Δ = [(100 − (Rv − Rp)) / 10] × k × D
 * Rv = winner rating, Rp = loser rating. Loser gets −Δ (with their own k/D in newcomer mode).
 */
import type { RatingConfig } from "./config";

export type RatingStatus = "NEW" | "PROVISIONAL" | "ESTABLISHED";
export type MatchType = "TOURNAMENT" | "CHALLENGE" | "CASUAL";

export type RatedPlayer = {
  id: string;
  rating: number; // must be > 0; NEW players (null rating) are rejected upstream
  status: Exclude<RatingStatus, "NEW">;
};

export type MatchContext =
  | { type: "TOURNAMENT"; averageRating: number }
  | { type: "CHALLENGE" }
  | { type: "CASUAL" };

export type MatchInput = {
  winner: RatedPlayer;
  loser: RatedPlayer;
  winnerSets: number;
  loserSets: number;
  context: MatchContext;
};

export type PlayerDelta = {
  playerId: string;
  ratingBefore: number;
  delta: number; // exact (unrounded)
  ratingAfter: number; // exact
  k: number;
  d: number;
  newcomerMode: boolean;
};

export type MatchCalculation = {
  version: number;
  rated: boolean;
  bigGapApplied: boolean;
  base: number; // (100 - (Rv - Rp)) / 10, before k and D
  ratingDifference: number; // Rv - Rp
  competitionK: number | null; // tournament/challenge k (null if unrated)
  competitionAverageRating: number | null;
  winner: PlayerDelta;
  loser: PlayerDelta;
};

export class RatingEngineError extends Error {}

export function kForAverageRating(avg: number, cfg: RatingConfig): number {
  for (const band of cfg.k_by_avg_rating) {
    if (band.max === null || avg < band.max) return band.k;
  }
  return cfg.k_by_avg_rating[cfg.k_by_avg_rating.length - 1].k;
}

export function dForScore(winnerSets: number, loserSets: number, cfg: RatingConfig): number {
  const key = `${winnerSets}:${loserSets}`;
  const d = cfg.d_by_sets[key];
  if (d === undefined) throw new RatingEngineError(`No D coefficient for score ${key}`);
  return d;
}

export function competitionK(ctx: MatchContext, cfg: RatingConfig): number {
  switch (ctx.type) {
    case "TOURNAMENT":
      return kForAverageRating(ctx.averageRating, cfg);
    case "CHALLENGE":
    case "CASUAL":
      return cfg.challenge_k;
  }
}

function validate(input: MatchInput) {
  const { winner, loser, winnerSets, loserSets } = input;
  if (winner.id === loser.id) throw new RatingEngineError("winner and loser must differ");
  if (!(winner.rating > 0) || !(loser.rating > 0))
    throw new RatingEngineError("both players must have a positive rating");
  if (!Number.isInteger(winnerSets) || !Number.isInteger(loserSets) || winnerSets <= loserSets)
    throw new RatingEngineError("winnerSets must exceed loserSets");
}

/**
 * Calculates deltas for both players. Does not mutate, does not round.
 * Newcomer rules (spec §15): for a PROVISIONAL player D = 1; k = 1 on win, 0.5 on loss.
 * Big-gap rule (spec §13): winner ahead by >= threshold → both deltas 0.
 */
export function calculateMatch(input: MatchInput, cfg: RatingConfig): MatchCalculation {
  validate(input);
  const { winner, loser, winnerSets, loserSets, context } = input;

  const rated = cfg.rated_match_types.includes(context.type);
  const diff = winner.rating - loser.rating;
  const bigGap = diff >= cfg.big_gap_threshold;
  const base = bigGap ? 0 : (100 - diff) / 10;

  const compK = rated ? competitionK(context, cfg) : null;
  const scoreD = dForScore(winnerSets, loserSets, cfg);

  const winnerNewcomer = winner.status === "PROVISIONAL";
  const loserNewcomer = loser.status === "PROVISIONAL";

  const wK = winnerNewcomer ? cfg.newcomer_win_k : (compK ?? 0);
  const wD = winnerNewcomer ? 1 : scoreD;
  const lK = loserNewcomer ? cfg.newcomer_loss_k : (compK ?? 0);
  const lD = loserNewcomer ? 1 : scoreD;

  const wDelta = rated ? base * wK * wD : 0;
  const lDelta = rated ? -(base * lK * lD) : 0;

  return {
    version: cfg.version,
    rated,
    bigGapApplied: bigGap,
    base,
    ratingDifference: diff,
    competitionK: compK,
    competitionAverageRating: context.type === "TOURNAMENT" ? context.averageRating : null,
    winner: {
      playerId: winner.id,
      ratingBefore: winner.rating,
      delta: wDelta,
      ratingAfter: winner.rating + wDelta,
      k: wK,
      d: wD,
      newcomerMode: winnerNewcomer,
    },
    loser: {
      playerId: loser.id,
      ratingBefore: loser.rating,
      delta: lDelta,
      ratingAfter: Math.max(loser.rating + lDelta, 1), // rating must stay > 0 (DB check)
      k: lK,
      d: lD,
      newcomerMode: loserNewcomer,
    },
  };
}

/** Display/accrual rounding per club rule (spec §59). Storage keeps exact decimals. */
export function roundRating(value: number, cfg: RatingConfig): number {
  switch (cfg.rounding) {
    case "HALF_UP_INTEGER":
      return Math.floor(value + 0.5);
    case "DECIMAL_2":
      return Math.round(value * 100) / 100;
  }
}

/** Average rating of rated tournament participants (NULL-rated newcomers excluded). */
export function tournamentAverageRating(ratings: Array<number | null>): number {
  const xs = ratings.filter((r): r is number => typeof r === "number" && r > 0);
  if (xs.length === 0) throw new RatingEngineError("tournament has no rated participants");
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
