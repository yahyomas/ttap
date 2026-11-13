/**
 * Round robin (league) format — pure, deterministic.
 *
 * Schedule: circle method. For n players (n odd → one bye per round) there are
 * n−1 (or n) rounds, every player meets every other exactly once. `round` is the
 * schedule round, `position` the table index within the round (1-based).
 *
 * Standings (table tennis convention, close to ITTF group rules):
 *   1. match points: 2 per win, 1 per loss (played), 0 unplayed
 *   2. among tied players: points in matches between them (head-to-head mini-table)
 *   3. among still tied: set ratio (won / lost) in matches between them, then overall
 *   4. seed (rating at lock) as a last resort — deterministic
 */
import { seedEntrants, type Entrant, type SeededEntrant } from "./bracket";

export type RoundRobinMatch = { round: number; position: number; player1Id: string; player2Id: string };

export type RoundRobinSchedule = {
  rounds: number;
  seeds: SeededEntrant[];
  matches: RoundRobinMatch[];
};

export function generateRoundRobin(entrants: Entrant[], tournamentId: string): RoundRobinSchedule {
  if (entrants.length < 2) throw new Error("at least 2 entrants required");
  const seeds = seedEntrants(entrants, tournamentId);
  const ids: (string | null)[] = seeds.map((s) => s.playerId);
  if (ids.length % 2 === 1) ids.push(null); // bye
  const n = ids.length;
  const rounds = n - 1;
  const matches: RoundRobinMatch[] = [];
  // circle method: fix ids[0], rotate the rest
  const ring = [...ids];
  for (let r = 1; r <= rounds; r++) {
    let pos = 1;
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a === null || b === null) continue;
      // alternate home/away so the fixed player doesn't always sit in slot 1
      const [p1, p2] = r % 2 === 0 && i === 0 ? [b, a] : [a, b];
      matches.push({ round: r, position: pos++, player1Id: p1, player2Id: p2 });
    }
    // rotate all but the first
    const last = ring.pop()!;
    ring.splice(1, 0, last);
  }
  return { rounds, seeds, matches };
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------
export type PlayedMatch = {
  player1Id: string | null;
  player2Id: string | null;
  winnerPlayerId: string | null;
  loserPlayerId: string | null;
  winnerSets: number | null;
  loserSets: number | null;
  status: string; // CONFIRMED counts
};

export type StandingRow = {
  playerId: string;
  place: number;
  played: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  /** how the position was decided: "points" | "h2h" | "sets" | "seed" */
  decidedBy: "points" | "h2h" | "sets" | "seed";
};

type Agg = { played: number; wins: number; losses: number; points: number; setsWon: number; setsLost: number };

function aggregate(playerIds: string[], matches: PlayedMatch[], only?: Set<string>): Map<string, Agg> {
  const agg = new Map<string, Agg>();
  for (const id of playerIds) agg.set(id, { played: 0, wins: 0, losses: 0, points: 0, setsWon: 0, setsLost: 0 });
  for (const m of matches) {
    if (m.status !== "CONFIRMED" || !m.winnerPlayerId || !m.loserPlayerId) continue;
    if (only && !(only.has(m.winnerPlayerId) && only.has(m.loserPlayerId))) continue;
    const w = agg.get(m.winnerPlayerId);
    const l = agg.get(m.loserPlayerId);
    if (!w || !l) continue;
    const ws = m.winnerSets ?? 0;
    const ls = m.loserSets ?? 0;
    w.played++; w.wins++; w.points += 2; w.setsWon += ws; w.setsLost += ls;
    l.played++; l.losses++; l.points += 1; l.setsWon += ls; l.setsLost += ws;
  }
  return agg;
}

function ratio(a: Agg): number {
  return a.setsLost === 0 ? (a.setsWon === 0 ? 0 : Infinity) : a.setsWon / a.setsLost;
}

/**
 * Orders players; `seedOf` gives the deterministic last-resort order (lower = better).
 */
export function computeStandings(
  playerIds: string[],
  matches: PlayedMatch[],
  seedOf: (playerId: string) => number,
): StandingRow[] {
  const overall = aggregate(playerIds, matches);

  // group by points
  const byPoints = new Map<number, string[]>();
  for (const id of playerIds) {
    const p = overall.get(id)!.points;
    if (!byPoints.has(p)) byPoints.set(p, []);
    byPoints.get(p)!.push(id);
  }
  const groups = [...byPoints.entries()].sort((a, b) => b[0] - a[0]).map((e) => e[1]);

  const ordered: { id: string; decidedBy: StandingRow["decidedBy"] }[] = [];
  for (const g of groups) {
    if (g.length === 1) {
      ordered.push({ id: g[0], decidedBy: "points" });
      continue;
    }
    const set = new Set(g);
    const h2h = aggregate(g, matches, set);
    const rows = g.map((id) => ({
      id,
      h2hPoints: h2h.get(id)!.points,
      h2hRatio: ratio(h2h.get(id)!),
      allRatio: ratio(overall.get(id)!),
      seed: seedOf(id),
    }));
    rows.sort((a, b) => {
      if (b.h2hPoints !== a.h2hPoints) return b.h2hPoints - a.h2hPoints;
      if (b.h2hRatio !== a.h2hRatio) return b.h2hRatio - a.h2hRatio;
      if (b.allRatio !== a.allRatio) return b.allRatio - a.allRatio;
      return a.seed - b.seed;
    });
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const prev = rows[i - 1];
      let decidedBy: StandingRow["decidedBy"] = "h2h";
      if (prev) {
        if (prev.h2hPoints === r.h2hPoints) decidedBy = prev.h2hRatio !== r.h2hRatio || prev.allRatio !== r.allRatio ? "sets" : "seed";
      } else {
        const next = rows[1];
        decidedBy = next.h2hPoints !== r.h2hPoints ? "h2h" : next.h2hRatio !== r.h2hRatio || next.allRatio !== r.allRatio ? "sets" : "seed";
      }
      ordered.push({ id: r.id, decidedBy });
    }
  }

  return ordered.map((o, i) => {
    const a = overall.get(o.id)!;
    return { playerId: o.id, place: i + 1, ...a, decidedBy: o.decidedBy };
  });
}
