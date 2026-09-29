import { describe, it, expect } from "vitest";
import {
  calculateMatch,
  kForAverageRating,
  dForScore,
  roundRating,
  tournamentAverageRating,
  RatingEngineError,
  type MatchInput,
} from "./engine";
import { DEFAULT_RATING_CONFIG as cfg } from "./config";
import { statusForTournamentCount, calculateNewcomerInitialRating } from "./newcomer";

const est = (id: string, rating: number) => ({ id, rating, status: "ESTABLISHED" as const });
const prov = (id: string, rating: number) => ({ id, rating, status: "PROVISIONAL" as const });
const tourney = (avg: number) => ({ type: "TOURNAMENT" as const, averageRating: avg });

function match(partial: Partial<MatchInput>): MatchInput {
  return {
    winner: est("A", 430),
    loser: est("B", 410),
    winnerSets: 3,
    loserSets: 1,
    context: tourney(400), // k = 0.30
    ...partial,
  };
}

describe("spec §59 worked example", () => {
  it("430 beats 410 3:1 with k=0.30 → +2.4 / −2.4", () => {
    const r = calculateMatch(match({}), cfg);
    expect(r.competitionK).toBe(0.3);
    expect(r.winner.d).toBe(1.0);
    expect(r.winner.delta).toBeCloseTo(2.4, 10);
    expect(r.loser.delta).toBeCloseTo(-2.4, 10);
    expect(r.winner.ratingAfter).toBeCloseTo(432.4, 10);
    expect(r.loser.ratingAfter).toBeCloseTo(407.6, 10);
  });
});

describe("§90 1–2: who wins", () => {
  it("1. lower rated player wins → larger positive delta", () => {
    const r = calculateMatch(match({ winner: est("A", 400), loser: est("B", 450) }), cfg);
    // base = (100 - (-50))/10 = 15 → 15 * 0.3 * 1.0 = 4.5
    expect(r.winner.delta).toBeCloseTo(4.5, 10);
    expect(r.loser.delta).toBeCloseTo(-4.5, 10);
  });
  it("2. higher rated player wins → smaller positive delta", () => {
    const r = calculateMatch(match({ winner: est("A", 450), loser: est("B", 400) }), cfg);
    // base = (100 - 50)/10 = 5 → 1.5
    expect(r.winner.delta).toBeCloseTo(1.5, 10);
  });
});

describe("§90 3–5: 100-point rule (§13)", () => {
  it("3. difference < 100 → normal calculation", () => {
    const r = calculateMatch(match({ winner: est("A", 499), loser: est("B", 400) }), cfg);
    expect(r.bigGapApplied).toBe(false);
    expect(r.winner.delta).toBeCloseTo(0.03, 10); // (100-99)/10 * 0.3
  });
  it("4. difference = 100 → zero", () => {
    const r = calculateMatch(match({ winner: est("A", 500), loser: est("B", 400) }), cfg);
    expect(r.bigGapApplied).toBe(true);
    expect(r.winner.delta).toBe(0);
    expect(r.loser.delta).toBe(-0);
    expect(r.loser.ratingAfter).toBe(400);
  });
  it("5. difference > 100 → zero", () => {
    const r = calculateMatch(match({ winner: est("A", 700), loser: est("B", 400) }), cfg);
    expect(r.winner.delta).toBe(0);
  });
});

describe("§90 6–8: D by score (§12)", () => {
  it("6. 3:0 → D = 1.2", () => {
    const r = calculateMatch(match({ winnerSets: 3, loserSets: 0 }), cfg);
    expect(r.winner.d).toBe(1.2);
    expect(r.winner.delta).toBeCloseTo(8 * 0.3 * 1.2, 10);
  });
  it("7. 3:1 → D = 1.0", () => {
    expect(dForScore(3, 1, cfg)).toBe(1.0);
  });
  it("8. 3:2 → D = 0.8", () => {
    const r = calculateMatch(match({ winnerSets: 3, loserSets: 2 }), cfg);
    expect(r.winner.d).toBe(0.8);
    expect(r.winner.delta).toBeCloseTo(8 * 0.3 * 0.8, 10);
  });
  it("2:1 and 2:0 map like 3:2 and 3:1", () => {
    expect(dForScore(2, 1, cfg)).toBe(0.8);
    expect(dForScore(2, 0, cfg)).toBe(1.0);
  });
});

describe("§90 9–10: newcomer rules (§15)", () => {
  it("9. newcomer win → k = 1, D = 1 for the newcomer; opponent uses normal k/D", () => {
    const r = calculateMatch(
      match({ winner: prov("N", 400), loser: est("B", 420), winnerSets: 3, loserSets: 0 }),
      cfg,
    );
    // base = (100 - (-20))/10 = 12
    expect(r.winner.newcomerMode).toBe(true);
    expect(r.winner.k).toBe(1);
    expect(r.winner.d).toBe(1);
    expect(r.winner.delta).toBeCloseTo(12, 10);
    expect(r.loser.newcomerMode).toBe(false);
    expect(r.loser.delta).toBeCloseTo(-(12 * 0.3 * 1.2), 10);
  });
  it("10. newcomer loss → k = 0.5, D = 1", () => {
    const r = calculateMatch(
      match({ winner: est("B", 420), loser: prov("N", 400), winnerSets: 3, loserSets: 0 }),
      cfg,
    );
    // base = (100 - 20)/10 = 8
    expect(r.loser.k).toBe(0.5);
    expect(r.loser.d).toBe(1);
    expect(r.loser.delta).toBeCloseTo(-4, 10);
    expect(r.winner.delta).toBeCloseTo(8 * 0.3 * 1.2, 10);
  });
});

describe("§90 11–12: status transitions (§14, §16)", () => {
  it("11. NEW → PROVISIONAL after first tournament", () => {
    expect(statusForTournamentCount(0, cfg)).toBe("NEW");
    expect(statusForTournamentCount(1, cfg)).toBe("PROVISIONAL");
  });
  it("12. PROVISIONAL → ESTABLISHED after more than N tournaments", () => {
    expect(statusForTournamentCount(5, cfg)).toBe("PROVISIONAL");
    expect(statusForTournamentCount(6, cfg)).toBe("ESTABLISHED");
  });
  it("initial newcomer rating: step 25, min 100, from opponents' mean ± step per result", () => {
    const r = calculateNewcomerInitialRating(
      [
        { opponentRating: 410, won: true },
        { opponentRating: 480, won: false },
        { opponentRating: null, won: true }, // unrated opponent ignored
      ],
      cfg,
    );
    // mean = 445, wins-losses = 0 → 445 → nearest 25 → 450
    expect(r).toBe(450);
    expect(calculateNewcomerInitialRating([{ opponentRating: 100, won: false }], cfg)).toBe(100);
    expect(calculateNewcomerInitialRating([{ opponentRating: null, won: true }], cfg)).toBeNull();
  });
});

describe("k by tournament average (§11)", () => {
  it("bands", () => {
    expect(kForAverageRating(200, cfg)).toBe(0.2);
    expect(kForAverageRating(250, cfg)).toBe(0.25);
    expect(kForAverageRating(349.9, cfg)).toBe(0.25);
    expect(kForAverageRating(350, cfg)).toBe(0.3);
    expect(kForAverageRating(450, cfg)).toBe(0.35);
    expect(kForAverageRating(550, cfg)).toBe(0.4);
    expect(kForAverageRating(900, cfg)).toBe(0.4);
  });
  it("average excludes unrated participants", () => {
    expect(tournamentAverageRating([400, null, 500])).toBe(450);
    expect(() => tournamentAverageRating([null])).toThrow(RatingEngineError);
  });
  it("challenge uses configured challenge_k", () => {
    const r = calculateMatch(match({ context: { type: "CHALLENGE" } }), cfg);
    expect(r.competitionK).toBe(cfg.challenge_k);
    expect(r.competitionAverageRating).toBeNull();
  });
});

describe("unrated match types & validation", () => {
  it("CASUAL is unrated by default → zero deltas, rated=false", () => {
    const r = calculateMatch(match({ context: { type: "CASUAL" } }), cfg);
    expect(r.rated).toBe(false);
    expect(r.winner.delta).toBe(0);
    expect(r.loser.delta).toBe(0);
  });
  it("rejects invalid input", () => {
    expect(() => calculateMatch(match({ winnerSets: 1, loserSets: 3 }), cfg)).toThrow();
    expect(() => calculateMatch(match({ loser: est("A", 410) }), cfg)).toThrow();
    expect(() => calculateMatch(match({ winnerSets: 4, loserSets: 1 }), cfg)).toThrow();
  });
  it("is deterministic", () => {
    const a = calculateMatch(match({}), cfg);
    const b = calculateMatch(match({}), cfg);
    expect(a).toEqual(b);
  });
});

describe("rounding (§59)", () => {
  it("HALF_UP_INTEGER", () => {
    expect(roundRating(2.4, cfg)).toBe(2);
    expect(roundRating(2.5, cfg)).toBe(3);
    expect(roundRating(432.4, cfg)).toBe(432);
  });
  it("DECIMAL_2", () => {
    expect(roundRating(2.456, { ...cfg, rounding: "DECIMAL_2" })).toBe(2.46);
  });
});
