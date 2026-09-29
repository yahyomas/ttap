/**
 * Newcomer lifecycle (spec §14–§16).
 *
 *   NEW ──(first tournament finished)──▶ PROVISIONAL ──(tournament_count > N)──▶ ESTABLISHED
 *
 * N = cfg.newcomer_tournaments (default 5): a player is a newcomer for their first 5 tournaments
 * inclusive, and becomes ESTABLISHED once the 6th is finished.
 */
import type { RatingConfig } from "./config";
import type { RatingStatus } from "./engine";

export function statusForTournamentCount(count: number, cfg: RatingConfig): RatingStatus {
  if (count <= 0) return "NEW";
  if (count <= cfg.newcomer_tournaments) return "PROVISIONAL";
  return "ESTABLISHED";
}

export type NewcomerTournamentResult = {
  /** Opponent rating (null if opponent was also unrated). */
  opponentRating: number | null;
  won: boolean;
};

/**
 * Initial Club Rating for a NEW player after their first tournament (spec §15).
 *
 * v1 (DEFAULT — to be confirmed against official RTTF rules, see spec §108):
 *   performance = mean(rated opponents) + step × (wins − losses)
 *   rounded to nearest `step`, floored at `min`.
 * Returns null if the newcomer met no rated opponents (admin must assign manually).
 */
export function calculateNewcomerInitialRating(
  results: NewcomerTournamentResult[],
  cfg: RatingConfig,
): number | null {
  const rated = results.filter((r) => r.opponentRating !== null && r.opponentRating > 0);
  if (rated.length === 0) return null;

  const mean = rated.reduce((a, r) => a + (r.opponentRating as number), 0) / rated.length;
  const wins = rated.filter((r) => r.won).length;
  const losses = rated.length - wins;
  const performance = mean + cfg.newcomer_initial_step * (wins - losses);

  const step = cfg.newcomer_initial_step;
  const rounded = Math.round(performance / step) * step;
  return Math.max(rounded, cfg.newcomer_initial_min);
}
