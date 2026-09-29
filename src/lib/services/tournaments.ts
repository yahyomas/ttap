/**
 * Tournament orchestration: loads data, runs pure domain code, calls atomic RPCs.
 * Server-only. All mutations go through RPCs that re-check admin role and validate inputs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  calculateMatch,
  calculateNewcomerInitialRating,
  kForAverageRating,
  parseRatingConfig,
  tournamentAverageRating,
  type MatchCalculation,
  type RatingConfig,
} from "@/domain/rating";
import { generateBracket, type Entrant } from "@/domain/tournament";

type DB = SupabaseClient<Database>;

export class TournamentError extends Error {}

async function loadConfig(db: DB, clubId: string): Promise<RatingConfig> {
  const { data, error } = await db.from("clubs").select("settings").eq("id", clubId).single();
  if (error) throw new TournamentError(error.message);
  return parseRatingConfig(data.settings);
}

// ---------------------------------------------------------------------------
// Lock bracket
// ---------------------------------------------------------------------------
export async function lockBracket(db: DB, tournamentId: string) {
  const { data: t, error: tErr } = await db.from("tournaments").select("*").eq("id", tournamentId).single();
  if (tErr || !t) throw new TournamentError("Турнир не найден");
  const cfg = await loadConfig(db, t.club_id);

  const { data: parts, error: pErr } = await db
    .from("tournament_participants")
    .select("player_id, players!inner(id, current_rating, rating_status)")
    .eq("tournament_id", tournamentId)
    .eq("status", "REGISTERED");
  if (pErr) throw new TournamentError(pErr.message);
  if (!parts || parts.length < 2) throw new TournamentError("Нужно минимум 2 участника");

  const entrants: Entrant[] = parts.map((p) => ({
    playerId: p.player_id,
    rating: p.players.current_rating,
    ratingStatus: p.players.rating_status,
  }));

  const bracket = generateBracket(entrants, tournamentId);
  const rated = entrants.map((e) => e.rating).filter((r): r is number => r !== null);
  const average = rated.length > 0 ? tournamentAverageRating(rated) : null;
  const k = average !== null ? kForAverageRating(average, cfg) : null;

  const payload = {
    size: bracket.size,
    rounds: bracket.rounds,
    average_rating: average,
    k,
    algorithm: cfg.algorithm,
    version: cfg.version,
    seeds: bracket.seeds.map((s) => ({
      player_id: s.playerId,
      seed: s.seed,
      rating: s.rating,
      rating_status: s.ratingStatus,
    })),
    matches: bracket.matches.map((m) => ({
      round: m.round,
      position: m.position,
      player1_id: m.player1Id,
      player2_id: m.player2Id,
    })),
    byes: bracket.byes,
  };

  const { error } = await db.rpc("admin_lock_bracket", { p_tournament_id: tournamentId, p_bracket: payload as Json });
  if (error) throw new TournamentError(error.message);
  return bracket;
}

// ---------------------------------------------------------------------------
// Match result
// ---------------------------------------------------------------------------
type Snapshot = { rating: number | null; status: "NEW" | "PROVISIONAL" | "ESTABLISHED" };

async function loadSnapshots(db: DB, tournamentId: string, playerIds: string[]) {
  const { data, error } = await db
    .from("tournament_participants")
    .select("player_id, rating_at_lock, rating_status_at_lock")
    .eq("tournament_id", tournamentId)
    .in("player_id", playerIds);
  if (error) throw new TournamentError(error.message);
  const map = new Map<string, Snapshot>();
  for (const r of data ?? []) {
    map.set(r.player_id, { rating: r.rating_at_lock, status: r.rating_status_at_lock ?? "NEW" });
  }
  return map;
}

export type MatchResultInput = {
  matchId: string;
  winnerPlayerId: string;
  winnerSets: number;
  loserSets: number;
};

/**
 * Computes deltas from ratings snapshotted at lock and applies them via RPC.
 * A match with a NEW player (no snapshot rating) is confirmed as unrated.
 */
async function prepareResult(db: DB, input: MatchResultInput) {
  const { data: m, error: mErr } = await db.from("matches").select("*").eq("id", input.matchId).single();
  if (mErr || !m) throw new TournamentError("Матч не найден");
  if (!m.tournament_id || !m.player1_id || !m.player2_id) throw new TournamentError("Оба игрока ещё не определены");
  if (![m.player1_id, m.player2_id].includes(input.winnerPlayerId)) throw new TournamentError("Победитель не из этого матча");

  const { data: t } = await db.from("tournaments").select("club_id, average_rating").eq("id", m.tournament_id).single();
  if (!t) throw new TournamentError("Турнир не найден");
  const cfg = await loadConfig(db, t.club_id);

  const loserId = input.winnerPlayerId === m.player1_id ? m.player2_id : m.player1_id;
  const snaps = await loadSnapshots(db, m.tournament_id, [input.winnerPlayerId, loserId]);
  const w = snaps.get(input.winnerPlayerId);
  const l = snaps.get(loserId);
  if (!w || !l) throw new TournamentError("Нет снапшота рейтинга участника");

  const rated = w.rating !== null && l.rating !== null && t.average_rating !== null && w.status !== "NEW" && l.status !== "NEW";

  let calc: MatchCalculation | null = null;
  let deltas: Json[] = [];
  if (rated) {
    calc = calculateMatch(
      {
        winner: { id: input.winnerPlayerId, rating: w.rating as number, status: w.status as "PROVISIONAL" | "ESTABLISHED" },
        loser: { id: loserId, rating: l.rating as number, status: l.status as "PROVISIONAL" | "ESTABLISHED" },
        winnerSets: input.winnerSets,
        loserSets: input.loserSets,
        context: { type: "TOURNAMENT", averageRating: t.average_rating as number },
      },
      cfg,
    );

    // rating_before must match the LIVE projection (RPC validates); delta comes from the snapshot.
    const { data: live } = await db.from("players").select("id, current_rating").in("id", [input.winnerPlayerId, loserId]);
    const liveMap = new Map((live ?? []).map((p) => [p.id, p.current_rating]));
    const mk = (pid: string, delta: number, side: "winner" | "loser") => {
      const before = liveMap.get(pid);
      if (before === null || before === undefined) throw new TournamentError("У игрока нет текущего рейтинга");
      const after = Math.max(before + delta, 1);
      return {
        player_id: pid,
        rating_before: before,
        delta: after - before,
        rating_after: after,
        calc: { ...calc![side], snapshot_rating: side === "winner" ? w.rating : l.rating },
      } as Json;
    };
    deltas = [mk(input.winnerPlayerId, calc.winner.delta, "winner"), mk(loserId, calc.loser.delta, "loser")];
  }

  const calcJson: Json = calc
    ? ({
        version: calc.version,
        rated: true,
        big_gap_applied: calc.bigGapApplied,
        base: calc.base,
        rating_difference: calc.ratingDifference,
        competition_k: calc.competitionK,
        competition_average_rating: calc.competitionAverageRating,
        winner: { ...calc.winner, snapshot_status: w.status },
        loser: { ...calc.loser, snapshot_status: l.status },
        source: "SNAPSHOT_AT_LOCK",
      } as unknown as Json)
    : ({ rated: false, reason: "UNRATED_NEWCOMER_INVOLVED" } as Json);

  return { match: m, loserId, rated, calc: calcJson, deltas, version: cfg.version };
}

export async function confirmTournamentMatch(db: DB, input: MatchResultInput) {
  const r = await prepareResult(db, input);
  const { error } = await db.rpc("admin_confirm_tournament_match", {
    p_match_id: input.matchId,
    p_winner_player_id: input.winnerPlayerId,
    p_winner_sets: input.winnerSets,
    p_loser_sets: input.loserSets,
    p_rated: r.rated,
    p_calc: r.calc,
    p_deltas: r.deltas,
    p_version: r.version,
  });
  if (error) throw new TournamentError(error.message);
}

export async function correctTournamentMatch(db: DB, input: MatchResultInput & { reason: string }) {
  // Reversal happens inside the RPC before the new deltas are applied, so rating_before must be
  // the rating AFTER reversal. Compute it from live values minus the existing (non-reversed) deltas.
  const { data: m } = await db.from("matches").select("*").eq("id", input.matchId).single();
  if (!m || !m.tournament_id || !m.player1_id || !m.player2_id) throw new TournamentError("Матч не найден");
  const { data: t } = await db.from("tournaments").select("club_id, average_rating").eq("id", m.tournament_id).single();
  if (!t) throw new TournamentError("Турнир не найден");
  const cfg = await loadConfig(db, t.club_id);

  const loserId = input.winnerPlayerId === m.player1_id ? m.player2_id : m.player1_id;
  const snaps = await loadSnapshots(db, m.tournament_id, [input.winnerPlayerId, loserId]);
  const w = snaps.get(input.winnerPlayerId)!;
  const l = snaps.get(loserId)!;
  const rated = w.rating !== null && l.rating !== null && t.average_rating !== null && w.status !== "NEW" && l.status !== "NEW";

  let deltas: Json[] = [];
  let calcJson: Json = { rated: false, reason: "UNRATED_NEWCOMER_INVOLVED" } as Json;
  if (rated) {
    const calc = calculateMatch(
      {
        winner: { id: input.winnerPlayerId, rating: w.rating as number, status: w.status as "PROVISIONAL" | "ESTABLISHED" },
        loser: { id: loserId, rating: l.rating as number, status: l.status as "PROVISIONAL" | "ESTABLISHED" },
        winnerSets: input.winnerSets,
        loserSets: input.loserSets,
        context: { type: "TOURNAMENT", averageRating: t.average_rating as number },
      },
      cfg,
    );
    // existing un-reversed transactions for this match
    const { data: txs } = await db
      .from("rating_transactions")
      .select("id, player_id, rating_delta, reason")
      .eq("match_id", input.matchId);
    const { data: reversals } = await db.from("rating_transactions").select("reverses_id").eq("match_id", input.matchId).eq("reason", "REVERSAL");
    const alreadyReversed = new Set((reversals ?? []).map((x) => x.reverses_id));
    const pendingReverse = new Map<string, number>();
    for (const x of txs ?? []) {
      if (x.reason !== "REVERSAL" && !alreadyReversed.has(x.id)) {
        pendingReverse.set(x.player_id, (pendingReverse.get(x.player_id) ?? 0) + x.rating_delta);
      }
    }
    const { data: live } = await db.from("players").select("id, current_rating").in("id", [input.winnerPlayerId, loserId]);
    const liveMap = new Map((live ?? []).map((p) => [p.id, p.current_rating]));
    const mk = (pid: string, delta: number, side: "winner" | "loser") => {
      const cur = liveMap.get(pid);
      if (cur === null || cur === undefined) throw new TournamentError("У игрока нет текущего рейтинга");
      const before = cur - (pendingReverse.get(pid) ?? 0);
      const after = Math.max(before + delta, 1);
      return { player_id: pid, rating_before: before, delta: after - before, rating_after: after, calc: calc[side] } as unknown as Json;
    };
    deltas = [mk(input.winnerPlayerId, calc.winner.delta, "winner"), mk(loserId, calc.loser.delta, "loser")];
    calcJson = { ...(calc as unknown as Record<string, Json>), source: "SNAPSHOT_AT_LOCK", corrected: true } as Json;
  }

  const { error } = await db.rpc("admin_correct_tournament_match", {
    p_match_id: input.matchId,
    p_winner_player_id: input.winnerPlayerId,
    p_winner_sets: input.winnerSets,
    p_loser_sets: input.loserSets,
    p_rated: rated,
    p_calc: calcJson,
    p_deltas: deltas,
    p_reason: input.reason,
    p_version: cfg.version,
  });
  if (error) throw new TournamentError(error.message);
}

// ---------------------------------------------------------------------------
// Completion (newcomer initial ratings)
// ---------------------------------------------------------------------------
export async function completeTournament(db: DB, tournamentId: string) {
  const { data: t } = await db.from("tournaments").select("club_id").eq("id", tournamentId).single();
  if (!t) throw new TournamentError("Турнир не найден");
  const cfg = await loadConfig(db, t.club_id);

  const { data: parts } = await db
    .from("tournament_participants")
    .select("player_id, rating_at_lock, rating_status_at_lock")
    .eq("tournament_id", tournamentId)
    .eq("status", "REGISTERED");
  const snap = new Map((parts ?? []).map((p) => [p.player_id, p.rating_at_lock]));
  const newcomers = (parts ?? []).filter((p) => p.rating_at_lock === null).map((p) => p.player_id);

  const { data: matches } = await db
    .from("matches")
    .select("winner_player_id, loser_player_id")
    .eq("tournament_id", tournamentId)
    .eq("status", "CONFIRMED");

  const payload: Json[] = [];
  const unresolved: string[] = [];
  for (const pid of newcomers) {
    const results = (matches ?? [])
      .filter((m) => m.winner_player_id === pid || m.loser_player_id === pid)
      .map((m) => {
        const opp = m.winner_player_id === pid ? m.loser_player_id! : m.winner_player_id!;
        return { opponentRating: snap.get(opp) ?? null, won: m.winner_player_id === pid };
      });
    const rating = calculateNewcomerInitialRating(results, cfg);
    if (rating === null) {
      unresolved.push(pid);
      continue;
    }
    payload.push({
      player_id: pid,
      rating,
      calc: { method: "NEWCOMER_INITIAL_V1", results, step: cfg.newcomer_initial_step, min: cfg.newcomer_initial_min },
    } as unknown as Json);
  }

  const { error } = await db.rpc("admin_complete_tournament", { p_tournament_id: tournamentId, p_newcomers: payload });
  if (error) throw new TournamentError(error.message);
  return { rated: payload.length, unresolved };
}
