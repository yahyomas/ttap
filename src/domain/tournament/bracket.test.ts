import { describe, it, expect } from "vitest";
import { generateBracket, seedOrder, nextPowerOfTwo, seedEntrants, roundLabel, type Entrant } from "./bracket";

const e = (id: string, rating: number | null): Entrant => ({
  playerId: id,
  rating,
  ratingStatus: rating === null ? "NEW" : "ESTABLISHED",
});

describe("seedOrder", () => {
  it("standard placement", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16)[0]).toBe(1);
    expect(seedOrder(16)[15]).toBe(11);
  });
  it("rejects non power of two", () => {
    expect(() => seedOrder(6)).toThrow();
  });
  it("nextPowerOfTwo", () => {
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(16)).toBe(16);
    expect(nextPowerOfTwo(18)).toBe(32);
  });
});

describe("seeding", () => {
  it("orders by rating desc, unrated last, deterministic tie-break", () => {
    const list = [e("a", 400), e("b", null), e("c", 500), e("d", 400)];
    const s1 = seedEntrants(list, "t1");
    const s2 = seedEntrants([...list].reverse(), "t1");
    expect(s1.map((x) => x.playerId)).toEqual(s2.map((x) => x.playerId));
    expect(s1[0].playerId).toBe("c");
    expect(s1[3].playerId).toBe("b");
    expect(new Set([s1[1].playerId, s1[2].playerId])).toEqual(new Set(["a", "d"]));
  });
  it("tie-break depends on tournament id (different draws for different tournaments)", () => {
    const list = Array.from({ length: 12 }, (_, i) => e(`p${i}`, 400));
    const a = seedEntrants(list, "t-alpha").map((x) => x.playerId).join();
    const b = seedEntrants(list, "t-beta").map((x) => x.playerId).join();
    expect(a).not.toEqual(b);
  });
});

describe("generateBracket", () => {
  it("4 players → 2 + 1 matches, no byes", () => {
    const b = generateBracket([e("a", 500), e("b", 450), e("c", 400), e("d", 350)], "t");
    expect(b.size).toBe(4);
    expect(b.rounds).toBe(2);
    expect(b.byes).toEqual([]);
    expect(b.matches).toEqual([
      { round: 1, position: 1, player1Id: "a", player2Id: "d" },
      { round: 1, position: 2, player1Id: "b", player2Id: "c" },
      { round: 2, position: 1, player1Id: null, player2Id: null },
    ]);
  });

  it("5 players → size 8, 3 byes for top seeds, byes pre-placed into round 2", () => {
    const b = generateBracket([e("s1", 600), e("s2", 550), e("s3", 500), e("s4", 450), e("s5", 400)], "t");
    expect(b.size).toBe(8);
    expect(b.rounds).toBe(3);
    expect(b.byes.sort()).toEqual(["s1", "s2", "s3"]);
    const r1 = b.matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(1);
    expect(r1[0]).toEqual({ round: 1, position: 2, player1Id: "s4", player2Id: "s5" });
    const r2 = b.matches.filter((m) => m.round === 2);
    // slots order 8: [1,8,4,5,2,7,3,6] → r1 matches: (s1,bye),(s4,s5),(s2,bye),(s3,bye)
    expect(r2).toEqual([
      { round: 2, position: 1, player1Id: "s1", player2Id: null }, // winner of r1 pos 2 goes to slot 2
      { round: 2, position: 2, player1Id: "s2", player2Id: "s3" },
    ]);
    expect(b.matches.filter((m) => m.round === 3)).toEqual([
      { round: 3, position: 1, player1Id: null, player2Id: null },
    ]);
  });

  it("18 players → size 32, 14 byes, 2 real first-round matches (seeds 15–18)", () => {
    const list = Array.from({ length: 18 }, (_, i) => e(`p${i}`, 600 - i * 10));
    const b = generateBracket(list, "friday");
    expect(b.size).toBe(32);
    expect(b.byes).toHaveLength(14);
    expect(b.matches.filter((m) => m.round === 1)).toHaveLength(2);
    expect(b.matches.filter((m) => m.round === 2)).toHaveLength(8);
    expect(b.matches).toHaveLength(2 + 8 + 4 + 2 + 1);
    // top seed gets a bye
    expect(b.byes).toContain("p0");
    // weakest two must play round 1
    const r1Ids = b.matches.filter((m) => m.round === 1).flatMap((m) => [m.player1Id, m.player2Id]);
    expect(r1Ids).toContain("p17");
    expect(r1Ids).toContain("p16");
  });

  it("unrated (NEW) players are seeded last and therefore play in round 1 first", () => {
    const b = generateBracket([e("a", 500), e("b", 450), e("n", null)], "t");
    expect(b.seeds[2].playerId).toBe("n");
    expect(b.byes).toEqual(["a"]);
  });

  it("every player appears exactly once, deterministic", () => {
    const list = Array.from({ length: 11 }, (_, i) => e(`p${i}`, i % 3 === 0 ? null : 300 + i));
    const b1 = generateBracket(list, "x");
    const b2 = generateBracket(list, "x");
    expect(b1).toEqual(b2);
    const placed = b1.matches.flatMap((m) => [m.player1Id, m.player2Id]).filter(Boolean);
    expect(placed.sort()).toEqual(list.map((x) => x.playerId).sort());
  });

  it("rejects fewer than 2", () => {
    expect(() => generateBracket([e("a", 1)], "t")).toThrow();
  });

  it("round labels", () => {
    expect(roundLabel(3, 3)).toBe("Финал");
    expect(roundLabel(2, 3)).toBe("1/2");
    expect(roundLabel(1, 3)).toBe("1/4");
    expect(roundLabel(1, 5)).toBe("1/16");
  });
});
