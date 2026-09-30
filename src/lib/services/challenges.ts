/**
 * Challenge result confirmation: computes deltas with the TS engine (live ratings, challenge k)
 * and applies them via the atomic RPC. A NEW player on either side → unrated match.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { calculateMatch, parseRatingConfig } from "@/domain/rating";

type DB = SupabaseClient<Database>;

export class ChallengeError extends Error {}

export async function confirmChallengeResult(db: DB, challengeId: string) {
  const { data: c, error } = await db.from("challenges").select("*").eq("id", challengeId).single();
  if (error || !c) throw new ChallengeError("Вызов не найден");
  if (c.status === "COMPLETED") return;
  if (c.status !== "RESULT_SUBMITTED" || !c.match_id) throw new ChallengeError("Результат ещё не внесён");

  const [{ data: m }, { data: club }, { data: players }] = await Promise.all([
    db.from("matches").select("*").eq("id", c.match_id).single(),
    db.from("clubs").select("settings").eq("id", c.club_id).single(),
    db.from("players").select("id, current_rating, rating_status").in("id", [c.challenger_id, c.opponent_id]),
  ]);
  if (!m || !m.winner_player_id || !m.loser_player_id || m.winner_sets === null || m.loser_sets === null) {
    throw new ChallengeError("Матч не найден или без счёта");
  }
  const cfg = parseRatingConfig(club?.settings);
  const byId = new Map((players ?? []).map((p) => [p.id, p]));
  const w = byId.get(m.winner_player_id);
  const l = byId.get(m.loser_player_id);
  if (!w || !l) throw new ChallengeError("Игрок не найден");

  const rated =
    w.current_rating !== null && l.current_rating !== null && w.rating_status !== "NEW" && l.rating_status !== "NEW";

  let deltas: Json[] = [];
  let calcJson: Json = { rated: false, reason: "UNRATED_NEWCOMER_INVOLVED" } as Json;

  if (rated) {
    const calc = calculateMatch(
      {
        winner: { id: w.id, rating: w.current_rating as number, status: w.rating_status as "PROVISIONAL" | "ESTABLISHED" },
        loser: { id: l.id, rating: l.current_rating as number, status: l.rating_status as "PROVISIONAL" | "ESTABLISHED" },
        winnerSets: m.winner_sets,
        loserSets: m.loser_sets,
        context: { type: "CHALLENGE" },
      },
      cfg,
    );
    const mk = (pid: string, before: number, delta: number, side: "winner" | "loser") => {
      const after = Math.max(before + delta, 1);
      return { player_id: pid, rating_before: before, delta: after - before, rating_after: after, calc: calc[side] } as unknown as Json;
    };
    deltas = [
      mk(w.id, w.current_rating as number, calc.winner.delta, "winner"),
      mk(l.id, l.current_rating as number, calc.loser.delta, "loser"),
    ];
    calcJson = { ...(calc as unknown as Record<string, Json>), source: "LIVE_RATINGS" } as Json;
  }

  const { error: rpcErr } = await db.rpc("confirm_challenge_result", {
    p_challenge_id: challengeId,
    p_rated: rated,
    p_calc: calcJson,
    p_deltas: deltas,
    p_version: cfg.version,
  });
  if (rpcErr) throw new ChallengeError(rpcErr.message);
}
