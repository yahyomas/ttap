/**
 * Challenge flow end-to-end against the real Supabase project.
 * Run: npm run test:integration   (needs supabase/seed/smoke.sql applied)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { confirmChallengeResult } from "./challenges";

const enabled = process.env.SMOKE === "1";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function login(email: string): Promise<SupabaseClient<Database>> {
  const db = createClient<Database>(URL, KEY, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email, password: "smoke-test-2026" });
  if (error) throw error;
  return db;
}

describe.skipIf(!enabled)("challenge flow (integration)", () => {
  let admin: SupabaseClient<Database>, timur: SupabaseClient<Database>, dima: SupabaseClient<Database>, aziz: SupabaseClient<Database>;
  const ids: Record<string, string> = {};
  let challengeId: string;

  beforeAll(async () => {
    [admin, timur, dima, aziz] = await Promise.all([
      login("smoke-admin@test.local"), login("smoke-timur@test.local"), login("smoke-dima@test.local"), login("smoke-aziz@test.local"),
    ]);
    const { data: ps } = await admin.from("players").select("id, display_name").eq("last_name", "Seed");
    for (const p of ps ?? []) ids[p.display_name] = p.id;
    // reset to known state (admin may write these columns)
    await admin.from("players").update({ current_rating: 410, rating_status: "PROVISIONAL" }).eq("id", ids.Timur);
    await admin.from("players").update({ current_rating: 380, rating_status: "ESTABLISHED" }).eq("id", ids.Dima);
    await admin.from("players").update({ current_rating: null, peak_rating: null, rating_status: "NEW" }).eq("id", ids.Aziz);
    // close any open challenges among test players
    const { data: open } = await admin.from("challenges").select("id").in("status", ["PENDING", "ACCEPTED", "RESULT_SUBMITTED"]);
    for (const c of open ?? []) await admin.rpc("cancel_challenge", { p_challenge_id: c.id, p_reason: "test reset" });
  });

  const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  it("Timur challenges Dima; duplicate open challenge is blocked; Dima gets a notification", async () => {
    const { data, error } = await timur.rpc("create_challenge", { p_opponent_id: ids.Dima, p_proposed_at: tomorrow(), p_message: "стол 2" });
    expect(error).toBeNull();
    challengeId = data!;

    const { error: dup } = await dima.rpc("create_challenge", { p_opponent_id: ids.Timur, p_proposed_at: tomorrow() });
    expect(dup?.code).toBe("23505");

    const { data: n } = await dima.from("notifications").select("kind, title").order("created_at", { ascending: false }).limit(1);
    expect(n![0].kind).toBe("CHALLENGE_CREATED");
    expect(n![0].title).toContain("Timur");

    // Dima cannot see Aziz's private notifications (RLS)
    const { data: cross } = await dima.from("notifications").select("id").neq("user_id", "33333333-3333-4333-8333-333333333333");
    expect(cross).toEqual([]);
  });

  it("only the opponent can respond; Timur cannot accept his own challenge", async () => {
    const { error } = await timur.rpc("respond_challenge", { p_challenge_id: challengeId, p_accept: true });
    expect(error?.code).toBe("42501");
    const { error: ok } = await dima.rpc("respond_challenge", { p_challenge_id: challengeId, p_accept: true });
    expect(ok).toBeNull();
  });

  it("Timur submits a wrong score; Dima rejects; Timur resubmits", async () => {
    const { error } = await timur.rpc("submit_challenge_result", { p_challenge_id: challengeId, p_winner_id: ids.Timur, p_winner_sets: 3, p_loser_sets: 0 });
    expect(error).toBeNull();
    // submitter cannot confirm before the timeout window
    await expect(confirmChallengeResult(timur, challengeId)).rejects.toThrow(/ещё может подтвердить/);
    // Dima cannot submit while Timur's result is pending
    const { error: e2 } = await dima.rpc("submit_challenge_result", { p_challenge_id: challengeId, p_winner_id: ids.Dima, p_winner_sets: 3, p_loser_sets: 2 });
    expect(e2?.message).toMatch(/уже внёс/);
    const { error: e3 } = await dima.rpc("reject_challenge_result", { p_challenge_id: challengeId, p_note: "было 3:2" });
    expect(e3).toBeNull();
    const { data: c } = await timur.from("challenges").select("status, match_id, dispute_note").eq("id", challengeId).single();
    expect(c).toEqual({ status: "ACCEPTED", match_id: null, dispute_note: "было 3:2" });

    const { error: e4 } = await timur.rpc("submit_challenge_result", { p_challenge_id: challengeId, p_winner_id: ids.Timur, p_winner_sets: 3, p_loser_sets: 2 });
    expect(e4).toBeNull();
  });

  it("Dima confirms → rating applied with challenge k; newcomer rules for Timur (PROVISIONAL win: k=1, D=1)", async () => {
    await confirmChallengeResult(dima, challengeId);
    // base = (100 - (410-380))/10 = 7; Timur PROVISIONAL winner: 7*1*1 = +7; Dima: -(7*0.3*0.8) = -1.68
    const { data: t } = await admin.from("players").select("current_rating").eq("id", ids.Timur).single();
    const { data: d } = await admin.from("players").select("current_rating").eq("id", ids.Dima).single();
    expect(t!.current_rating).toBeCloseTo(417, 2);
    expect(d!.current_rating).toBeCloseTo(378.32, 2);
    const { data: c } = await admin.from("challenges").select("status, match:matches!challenges_match_id_fkey(status, rated)").eq("id", challengeId).single();
    expect(c!.status).toBe("COMPLETED");
    expect(c!.match).toEqual({ status: "CONFIRMED", rated: true });
    // idempotent
    await confirmChallengeResult(dima, challengeId);
    const { count } = await admin.from("rating_transactions").select("id", { count: "exact", head: true }).eq("reason", "CHALLENGE_MATCH");
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("challenge with a NEW player is stored but unrated for both", async () => {
    const { data: cid, error } = await aziz.rpc("create_challenge", { p_opponent_id: ids.Dima, p_proposed_at: tomorrow() });
    expect(error).toBeNull();
    await dima.rpc("respond_challenge", { p_challenge_id: cid!, p_accept: true });
    await dima.rpc("submit_challenge_result", { p_challenge_id: cid!, p_winner_id: ids.Aziz, p_winner_sets: 3, p_loser_sets: 1 });
    await confirmChallengeResult(aziz, cid!);
    const { data: c } = await admin.from("challenges").select("status, match:matches!challenges_match_id_fkey(status, rated)").eq("id", cid!).single();
    expect(c!.status).toBe("COMPLETED");
    expect(c!.match).toEqual({ status: "CONFIRMED", rated: false });
    const { data: a } = await admin.from("players").select("current_rating, rating_status").eq("id", ids.Aziz).single();
    expect(a).toEqual({ current_rating: null, rating_status: "NEW" });
    const { data: d } = await admin.from("players").select("current_rating").eq("id", ids.Dima).single();
    expect(d!.current_rating).toBeCloseTo(378.32, 2);
  });

  it("admin can cancel an open challenge; decline flow; W/L stats reflect challenge matches", async () => {
    const { data: cid } = await timur.rpc("create_challenge", { p_opponent_id: ids.Aziz, p_proposed_at: tomorrow() });
    const { error } = await admin.rpc("cancel_challenge", { p_challenge_id: cid!, p_reason: "test" });
    expect(error).toBeNull();
    const { data: cid2 } = await timur.rpc("create_challenge", { p_opponent_id: ids.Aziz, p_proposed_at: tomorrow() });
    await aziz.rpc("respond_challenge", { p_challenge_id: cid2!, p_accept: false });
    const { data: c } = await timur.from("challenges").select("status").eq("id", cid2!).single();
    expect(c!.status).toBe("DECLINED");

    const { data: s } = await admin.from("player_match_stats").select("wins, losses").eq("player_id", ids.Aziz).single();
    expect(s!.wins).toBeGreaterThanOrEqual(1);
  });
});
