import { describe, expect, it } from "vitest";
import { computeStandings, generateRoundRobin, type PlayedMatch } from "./roundrobin";

const e = (id: string, rating: number | null) => ({ playerId: id, rating, ratingStatus: rating ? ("ESTABLISHED" as const) : ("NEW" as const) });

describe("generateRoundRobin", () => {
  it("every pair meets exactly once (even n)", () => {
    const s = generateRoundRobin([e("a", 500), e("b", 400), e("c", 300), e("d", 200)], "t");
    expect(s.rounds).toBe(3);
    expect(s.matches).toHaveLength(6);
    const pairs = new Set(s.matches.map((m) => [m.player1Id, m.player2Id].sort().join("-")));
    expect(pairs.size).toBe(6);
    for (let r = 1; r <= 3; r++) {
      const ids = s.matches.filter((m) => m.round === r).flatMap((m) => [m.player1Id, m.player2Id]);
      expect(new Set(ids).size).toBe(4); // nobody plays twice in a round
    }
  });

  it("odd n → one bye per round, n rounds", () => {
    const s = generateRoundRobin([e("a", 500), e("b", 400), e("c", 300)], "t");
    expect(s.rounds).toBe(3);
    expect(s.matches).toHaveLength(3);
    for (let r = 1; r <= 3; r++) expect(s.matches.filter((m) => m.round === r)).toHaveLength(1);
  });

  it("seeds by rating, NEW players last", () => {
    const s = generateRoundRobin([e("new", null), e("a", 300), e("b", 500)], "t");
    expect(s.seeds.map((x) => x.playerId)).toEqual(["b", "a", "new"]);
  });
});

const played = (w: string, l: string, ws = 3, ls = 0): PlayedMatch => ({
  player1Id: w, player2Id: l, winnerPlayerId: w, loserPlayerId: l, winnerSets: ws, loserSets: ls, status: "CONFIRMED",
});
const seedOf = (ids: string[]) => (id: string) => ids.indexOf(id) + 1;

describe("computeStandings", () => {
  it("orders by points: 2 per win, 1 per loss", () => {
    const rows = computeStandings(["a", "b", "c"], [played("a", "b"), played("a", "c"), played("b", "c")], seedOf(["a", "b", "c"]));
    expect(rows.map((r) => [r.playerId, r.place, r.points])).toEqual([["a", 1, 4], ["b", 2, 3], ["c", 3, 2]]);
    expect(rows[0].decidedBy).toBe("points");
  });

  it("three-way tie → head-to-head mini table, then set ratio", () => {
    // a>b, b>c, c>a (circle) → all 1-1; a won 3:0, lost 2:3 → ratio 5/3; b won 3:2 lost 0:3 → 3/5; c won 3:2 lost 2:3 → 5/5
    const ms = [played("a", "b", 3, 0), played("b", "c", 3, 2), played("c", "a", 3, 2)];
    const rows = computeStandings(["a", "b", "c"], ms, seedOf(["c", "b", "a"]));
    expect(rows.map((r) => r.playerId)).toEqual(["a", "c", "b"]);
    expect(rows[0].decidedBy).toBe("sets");
  });

  it("two-way tie → head-to-head winner first", () => {
    // a, b both 1 win 1 loss; a beat b
    const ms = [played("a", "b"), played("c", "a"), played("b", "c"), played("c", "d"), played("a", "d"), played("d", "b")];
    const rows = computeStandings(["a", "b", "c", "d"], ms, seedOf(["b", "a", "c", "d"]));
    // c: 3 wins. a: 2 wins (b,d). b: 1 win. d: 1 win. b beat? d beat b → d above b by h2h
    expect(rows.map((r) => r.playerId)).toEqual(["c", "a", "d", "b"]);
    expect(rows[2].decidedBy).toBe("h2h");
  });

  it("falls back to seed when nothing separates players", () => {
    const rows = computeStandings(["a", "b"], [], seedOf(["b", "a"]));
    expect(rows.map((r) => r.playerId)).toEqual(["b", "a"]);
    expect(rows[0].decidedBy).toBe("seed");
  });

  it("ignores unconfirmed matches", () => {
    const rows = computeStandings(["a", "b"], [{ ...played("a", "b"), status: "PENDING" }], seedOf(["a", "b"]));
    expect(rows[0].played).toBe(0);
  });
});
