import Link from "next/link";
import { computeStandings } from "@/domain/tournament";
import type { Tables } from "@/lib/supabase/database.types";
import { MatchResultForm } from "./MatchResultForm";
import type { MatchDeltas } from "./BracketView";

type Match = Tables<"matches">;

function fmtDelta(d: number) {
  const r = Math.floor(d + 0.5);
  return `${r >= 0 ? "+" : ""}${r}`;
}

export function StandingsTable({
  playerIds,
  matches,
  seedOf,
  names,
  linkBase,
  final = false,
}: {
  playerIds: string[];
  matches: Match[];
  seedOf: Map<string, number>;
  names: Map<string, string>;
  linkBase: string;
  final?: boolean;
}) {
  const rows = computeStandings(
    playerIds,
    matches.map((m) => ({
      player1Id: m.player1_id, player2Id: m.player2_id, winnerPlayerId: m.winner_player_id, loserPlayerId: m.loser_player_id,
      winnerSets: m.winner_sets, loserSets: m.loser_sets, status: m.status,
    })),
    (id) => seedOf.get(id) ?? 999,
  );
  const total = playerIds.length - 1;
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Игрок</th>
            <th className="px-3 py-2 text-center" title="Сыграно">И</th>
            <th className="px-3 py-2 text-center" title="Победы">В</th>
            <th className="px-3 py-2 text-center" title="Поражения">П</th>
            <th className="px-3 py-2 text-center" title="Сеты выиграно : проиграно">Сеты</th>
            <th className="px-3 py-2 text-right" title="Очки: 2 за победу, 1 за поражение">Очки</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.playerId} className={final && r.place === 1 ? "bg-emerald-500/10" : ""}>
              <td className="px-3 py-2 tabular-nums text-muted">
                {final && r.place === 1 ? "🏆" : final && r.place === 2 ? "🥈" : final && r.place === 3 ? "🥉" : r.place}
              </td>
              <td className="px-3 py-2">
                <Link href={`${linkBase}/${r.playerId}`} className={`hover:underline ${r.place === 1 ? "font-semibold" : "font-medium"}`}>
                  {names.get(r.playerId) ?? "?"}
                </Link>
                {r.decidedBy !== "points" && r.played === total && (
                  <span className="ml-2 text-[10px] uppercase text-muted" title="Место определено по доп. показателю">
                    {r.decidedBy === "h2h" ? "личные встречи" : r.decidedBy === "sets" ? "по сетам" : "по посеву"}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-center tabular-nums text-muted">{r.played}<span className="text-xs">/{total}</span></td>
              <td className="px-3 py-2 text-center tabular-nums">{r.wins}</td>
              <td className="px-3 py-2 text-center tabular-nums">{r.losses}</td>
              <td className="px-3 py-2 text-center tabular-nums text-muted">{r.setsWon}:{r.setsLost}</td>
              <td className="px-3 py-2 text-right text-base font-semibold tabular-nums">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoundRobinMatches({
  matches,
  rounds,
  names,
  admin = false,
  tournamentId,
  tournamentActive = false,
  deltas,
}: {
  matches: Match[];
  rounds: number;
  names: Map<string, string>;
  admin?: boolean;
  tournamentId: string;
  tournamentActive?: boolean;
  deltas?: MatchDeltas;
}) {
  const byRound = new Map<number, Match[]>();
  for (const m of matches) {
    const r = m.round ?? 1;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(m);
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
        <div key={r}>
          <div className="mb-2 text-xs font-semibold uppercase text-muted">Тур {r}</div>
          <div className="space-y-2">
            {(byRound.get(r) ?? []).map((m) => {
              const played = m.status === "CONFIRMED";
              const p1Win = played && m.winner_player_id === m.player1_id;
              const p2Win = played && m.winner_player_id === m.player2_id;
              const s = (pid: string | null) => (!played || !pid ? null : pid === m.winner_player_id ? m.winner_sets : m.loser_sets);
              const md = deltas?.get(m.id);
              const d = (pid: string | null) => (played && m.rated && pid ? md?.get(pid) : undefined);
              const canEnter = admin && tournamentActive && m.status === "PENDING";
              const canCorrect = admin && tournamentActive && played;
              const row = (pid: string | null, win: boolean) => {
                const delta = d(pid);
                return (
                  <div className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm ${win ? "bg-emerald-500/10 font-semibold" : played ? "text-muted" : ""}`}>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {win && <span className="text-emerald-500">✓</span>}
                      <span className="truncate">{pid ? names.get(pid) ?? "?" : "—"}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      {delta !== undefined && <span className={`text-[11px] ${delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtDelta(delta)}</span>}
                      {s(pid) !== null && <span className={`text-base ${win ? "" : "text-muted"}`}>{s(pid)}</span>}
                    </span>
                  </div>
                );
              };
              return (
                <div key={m.id} className={`card divide-y divide-border p-0 ${m.status === "CANCELLED" ? "opacity-50" : ""}`}>
                  {row(m.player1_id, p1Win)}
                  {row(m.player2_id, p2Win)}
                  {played && (
                    <div className="flex items-center justify-between px-3 py-1 text-[11px] text-muted">
                      <span>Сыграно · {m.winner_sets}:{m.loser_sets}</span>
                      <span>{m.rated === false ? "без рейтинга" : "с рейтингом"}</span>
                    </div>
                  )}
                  {!played && m.status === "PENDING" && !admin && <div className="px-3 py-1 text-[11px] text-muted">не сыгран</div>}
                  {(canEnter || canCorrect) && m.player1_id && m.player2_id && (
                    <div className="p-2">
                      <MatchResultForm
                        key={`${m.id}-${canCorrect ? "correct" : "confirm"}`}
                        matchId={m.id}
                        tournamentId={tournamentId}
                        player1={{ id: m.player1_id, name: names.get(m.player1_id) ?? "?" }}
                        player2={{ id: m.player2_id, name: names.get(m.player2_id) ?? "?" }}
                        mode={canCorrect ? "correct" : "confirm"}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
