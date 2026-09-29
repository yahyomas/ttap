import { roundLabel } from "@/domain/tournament";
import type { Tables } from "@/lib/supabase/database.types";
import { MatchResultForm } from "./MatchResultForm";

type Match = Tables<"matches">;

function Slot({ id, names, winner, sets }: { id: string | null; names: Map<string, string>; winner: boolean; sets: number | null }) {
  return (
    <div className={`flex items-center justify-between px-3 py-1.5 text-sm ${winner ? "font-semibold" : ""} ${id ? "" : "text-muted"}`}>
      <span className="truncate">{id ? (names.get(id) ?? "?") : "—"}</span>
      {sets !== null && <span className="ml-2 tabular-nums">{sets}</span>}
    </div>
  );
}

export function BracketView({
  matches,
  rounds,
  names,
  admin = false,
  tournamentId,
  tournamentActive = false,
}: {
  matches: Match[];
  rounds: number;
  names: Map<string, string>;
  admin?: boolean;
  tournamentId: string;
  tournamentActive?: boolean;
}) {
  if (matches.length === 0) return <div className="card text-sm text-muted">Сетка ещё не сформирована.</div>;

  const byRound = new Map<number, Match[]>();
  for (const m of matches) {
    const r = m.round ?? 1;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(m);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-6">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => {
          const ms = byRound.get(r) ?? [];
          return (
            <div key={r} className="flex w-56 flex-col">
              <div className="mb-2 text-xs font-semibold uppercase text-muted">{roundLabel(r, rounds)}</div>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {ms.map((m) => {
                  const p1Win = m.status === "CONFIRMED" && m.winner_player_id === m.player1_id;
                  const p2Win = m.status === "CONFIRMED" && m.winner_player_id === m.player2_id;
                  const s = (pid: string | null) =>
                    m.status !== "CONFIRMED" || !pid ? null : pid === m.winner_player_id ? m.winner_sets : m.loser_sets;
                  const canEnter = admin && tournamentActive && m.status === "PENDING" && !!m.player1_id && !!m.player2_id;
                  const canCorrect = admin && tournamentActive && m.status === "CONFIRMED";
                  return (
                    <div key={m.id} className={`card divide-y divide-border p-0 ${m.status === "CANCELLED" ? "opacity-50" : ""}`}>
                      <Slot id={m.player1_id} names={names} winner={p1Win} sets={s(m.player1_id)} />
                      <Slot id={m.player2_id} names={names} winner={p2Win} sets={s(m.player2_id)} />
                      {m.status === "CONFIRMED" && m.rated === false && (
                        <div className="px-3 py-1 text-[11px] text-muted">без рейтинга</div>
                      )}
                      {(canEnter || canCorrect) && (
                        <div className="p-2">
                          <MatchResultForm
                            matchId={m.id}
                            tournamentId={tournamentId}
                            player1={{ id: m.player1_id!, name: names.get(m.player1_id!) ?? "?" }}
                            player2={{ id: m.player2_id!, name: names.get(m.player2_id!) ?? "?" }}
                            mode={canCorrect ? "correct" : "confirm"}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
