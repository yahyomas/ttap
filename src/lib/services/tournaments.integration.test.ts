/**
 * End-to-end smoke test against the real Supabase project (spec §90 #13, #14, #16 flows).
 * Run: SMOKE=1 npm run test:integration
 * Requires: smoke admin user (see supabase/seed/smoke.sql) and seed players.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { completeTournament, confirmTournamentMatch, correctTournamentMatch, lockBracket } from "./tournaments";

const enabled = process.env.SMOKE === "1";

describe.skipIf(!enabled)("tournament flow (integration)", () => {
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  let clubId: string;
  let tournamentId: string;
  const players = new Map<string, { id: string; rating: number | null }>();

  beforeAll(async () => {
    const { error } = await db.auth.signInWithPassword({ email: "smoke-admin@test.local", password: "smoke-test-2026" });
    if (error) throw error;
    const { data: club } = await db.from("clubs").select("id").eq("slug", "tt-club").single();
    clubId = club!.id;
    const { data: ps } = await db.from("players").select("id, display_name, current_rating").eq("club_id", clubId).eq("last_name", "Seed");
    for (const p of ps ?? []) players.set(p.display_name, { id: p.id, rating: p.current_rating });
    expect(players.size).toBe(6);
  });

  it("creates tournament and registers 6 players (admin inserts on their behalf)", async () => {
    const { data: t, error } = await db
      .from("tournaments")
      .insert({ club_id: clubId, name: `Smoke ${Date.now()}`, starts_at: new Date().toISOString(), status: "REGISTRATION_OPEN" })
      .select("id")
      .single();
    expect(error).toBeNull();
    tournamentId = t!.id;

    const rows = [...players.values()].map((p) => ({ club_id: clubId, tournament_id: tournamentId, player_id: p.id }));
    const { error: rErr } = await db.from("tournament_participants").insert(rows);
    expect(rErr).toBeNull();

    // duplicate registration blocked by constraint (spec §65)
    const { error: dup } = await db.from("tournament_participants").insert(rows[0]);
    expect(dup?.code).toBe("23505");
  });

  it("locks bracket: size 8, 2 byes to top seeds, NEW player seeded last", async () => {
    const b = await lockBracket(db, tournamentId);
    expect(b.size).toBe(8);
    expect(b.byes.sort()).toEqual([players.get("Alex")!.id, players.get("Bek")!.id].sort());
    expect(b.seeds[5].playerId).toBe(players.get("Aziz")!.id);

    const { data: t } = await db.from("tournaments").select("status, average_rating, k, bracket_size").eq("id", tournamentId).single();
    expect(t!.status).toBe("IN_PROGRESS");
    expect(t!.average_rating).toBe(431); // (520+495+410+380+350)/5
    expect(t!.k).toBe(0.3);

    const { data: ms } = await db.from("matches").select("round, position, next_match_id, next_slot").eq("tournament_id", tournamentId);
    expect(ms!.length).toBe(2 + 2 + 1);
    expect(ms!.filter((m) => m.round === 3)[0].next_match_id).toBeNull();
    expect(ms!.filter((m) => m.round === 1).every((m) => m.next_match_id !== null)).toBe(true);
  });

  async function findMatch(a: string, b: string) {
    const { data } = await db.from("matches").select("*").eq("tournament_id", tournamentId);
    const ids = [players.get(a)!.id, players.get(b)!.id];
    const m = data!.find((x) => ids.includes(x.player1_id!) && ids.includes(x.player2_id!));
    if (!m) throw new Error(`match ${a} vs ${b} not found`);
    return m;
  }

  it("round 1: Timur (PROVISIONAL 410) beats Aziz (NEW) → unrated; Dima (380) vs Sasha (350)", async () => {
    // seeds 3 vs 6: Timur vs Aziz; seeds 4 vs 5: Dima vs Sasha
    const m1 = await findMatch("Timur", "Aziz");
    await confirmTournamentMatch(db, { matchId: m1.id, winnerPlayerId: players.get("Timur")!.id, winnerSets: 3, loserSets: 0 });
    const { data: m1b } = await db.from("matches").select("status, rated").eq("id", m1.id).single();
    expect(m1b).toEqual({ status: "CONFIRMED", rated: false });
    const { data: timur } = await db.from("players").select("current_rating").eq("id", players.get("Timur")!.id).single();
    expect(timur!.current_rating).toBe(410);

    const m2 = await findMatch("Dima", "Sasha");
    await confirmTournamentMatch(db, { matchId: m2.id, winnerPlayerId: players.get("Sasha")!.id, winnerSets: 3, loserSets: 2 });
    // base = (100 - (350-380))/10 = 13; k=0.3; D=0.8 → 3.12
    const { data: sasha } = await db.from("players").select("current_rating").eq("id", players.get("Sasha")!.id).single();
    expect(sasha!.current_rating).toBeCloseTo(353.12, 2);
    const { data: dima } = await db.from("players").select("current_rating").eq("id", players.get("Dima")!.id).single();
    expect(dima!.current_rating).toBeCloseTo(376.88, 2);

    // idempotent re-submit (spec §90 #13)
    await confirmTournamentMatch(db, { matchId: m2.id, winnerPlayerId: players.get("Sasha")!.id, winnerSets: 3, loserSets: 2 });
    const { count } = await db.from("rating_transactions").select("id", { count: "exact", head: true }).eq("match_id", m2.id);
    expect(count).toBe(2);
  });

  it("correction (spec §90 #14): Dima actually won 3:2 → reversal + new transactions", async () => {
    const m2 = await findMatch("Dima", "Sasha");
    await correctTournamentMatch(db, { matchId: m2.id, winnerPlayerId: players.get("Dima")!.id, winnerSets: 3, loserSets: 2, reason: "смоук: ошибка ввода" });
    const { data: txs } = await db.from("rating_transactions").select("reason, rating_delta").eq("match_id", m2.id).order("created_at");
    expect(txs!.map((t) => t.reason)).toEqual(["TOURNAMENT_MATCH", "TOURNAMENT_MATCH", "REVERSAL", "REVERSAL", "TOURNAMENT_MATCH", "TOURNAMENT_MATCH"]);
    // base = (100 - 30)/10 = 7 → 7*0.3*0.8 = 1.68
    const { data: dima } = await db.from("players").select("current_rating").eq("id", players.get("Dima")!.id).single();
    expect(dima!.current_rating).toBeCloseTo(381.68, 2);
    const { data: sasha } = await db.from("players").select("current_rating").eq("id", players.get("Sasha")!.id).single();
    expect(sasha!.current_rating).toBeCloseTo(348.32, 2);
    // bracket advancement fixed: Dima now in round 2
    const { data: r2 } = await db.from("matches").select("player1_id, player2_id").eq("tournament_id", tournamentId).eq("round", 2);
    const r2ids = r2!.flatMap((m) => [m.player1_id, m.player2_id]);
    expect(r2ids).toContain(players.get("Dima")!.id);
    expect(r2ids).not.toContain(players.get("Sasha")!.id);
  });

  it("plays out the rest; newcomer-mode delta for Timur uses k=0.5/D=1 on loss", async () => {
    const sf1 = await findMatch("Alex", "Dima");
    await confirmTournamentMatch(db, { matchId: sf1.id, winnerPlayerId: players.get("Alex")!.id, winnerSets: 3, loserSets: 1 });
    const sf2 = await findMatch("Bek", "Timur");
    await confirmTournamentMatch(db, { matchId: sf2.id, winnerPlayerId: players.get("Bek")!.id, winnerSets: 3, loserSets: 0 });
    // Timur (PROVISIONAL) loses: base=(100-(495-410))/10=1.5 ; loser k=0.5 D=1 → -0.75 ; Bek: 1.5*0.3*1.2 = 0.54
    const { data: timur } = await db.from("players").select("current_rating").eq("id", players.get("Timur")!.id).single();
    expect(timur!.current_rating).toBeCloseTo(409.25, 2);
    const { data: bek } = await db.from("players").select("current_rating").eq("id", players.get("Bek")!.id).single();
    expect(bek!.current_rating).toBeCloseTo(495.54, 2);

    const final = await findMatch("Alex", "Bek");
    await confirmTournamentMatch(db, { matchId: final.id, winnerPlayerId: players.get("Bek")!.id, winnerSets: 3, loserSets: 2 });
  });

  it("completes: champion, newcomer initial rating, tournament_count++, status transitions", async () => {
    const r = await completeTournament(db, tournamentId);
    expect(r.rated).toBe(1);
    expect(r.unresolved).toEqual([]);

    const { data: t } = await db.from("tournaments").select("status, winner_player_id").eq("id", tournamentId).single();
    expect(t!.status).toBe("COMPLETED");
    expect(t!.winner_player_id).toBe(players.get("Bek")!.id);

    // Aziz: lost to Timur (410 at lock) → mean 410 - 25 = 385 → nearest 25 → 375
    const { data: aziz } = await db.from("players").select("current_rating, rating_status, tournament_count").eq("id", players.get("Aziz")!.id).single();
    expect(aziz).toEqual({ current_rating: 375, rating_status: "PROVISIONAL", tournament_count: 1 });

    // Timur: 2 → 3 tournaments, still PROVISIONAL; Sasha: 9 → 10, ESTABLISHED
    const { data: timur } = await db.from("players").select("rating_status, tournament_count").eq("id", players.get("Timur")!.id).single();
    expect(timur).toEqual({ rating_status: "PROVISIONAL", tournament_count: 3 });

    // idempotent
    await completeTournament(db, tournamentId);
  });
});
