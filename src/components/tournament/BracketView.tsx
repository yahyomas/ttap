import { roundLabel } from "@/domain/tournament";
import type { Tables } from "@/lib/supabase/database.types";
import { MatchResultForm } from "./MatchResultForm";

type Match = Tables<"matches">;
/** match_id -> player_id -> net rating delta (sum of transactions for that match) */
export type MatchDeltas = Map<string, Map<string, number>>;

export function buildMatchDeltas(txs: { match_id: string | null; player_id: string; rating_delta: number }[]): MatchDeltas {
  const out: MatchDeltas = new Map();
  for (const x of txs) {
    if (!x.match_id) continue;
    if (!out.has(x.match_id)) out.set(x.match_id, new Map());
    const m = out.get(x.match_id)!;
    m.set(x.player_id, (m.get(x.player_id) ?? 0) + x.rating_delta);
  }
  return out;
}

function fmtDelta(d: number) {
  const r = Math.floor(d + 0.5);
  return `${r >= 0 ? "+" : ""}${r}`;
}

function Slot({
  id, names, winner, sets, played, delta,
}: { id: string | null; names: Map<string, string>; winner: boolean; sets: number | null; played: boolean; delta?: number }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
        winner ? "bg-emerald-500/10 font-semibold" : played ? "text-muted" : ""
      } ${id ? "" : "text-muted"}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {winner && <span className="text-emerald-500" aria-label="победитель">✓</span>}
        <span className="truncate">{id ? (names.get(id) ?? "?") : "—"}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 tabular-nums">
        {delta !== undefined && (
          <span className={`text-[11px] ${delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtDelta(delta)}</span>
        )}
        {sets !== null && <span className={`text-base ${winner ? "" : "text-muted"}`}>{sets}</span>}
      </span>
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
            <div key={r} className="flex w-60 flex-col">
              <div className="mb-2 text-xs font-semibold uppercase text-muted">{roundLabel(r, rounds)}</div>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {ms.map((m) => {
                  const played = m.status === "CONFIRMED";
                  const p1Win = played && m.winner_player_id === m.player1_id;
                  const p2Win = played && m.winner_player_id === m.player2_id;
                  const s = (pid: string | null) =>
                    !played || !pid ? null : pid === m.winner_player_id ? m.winner_sets : m.loser_sets;
                  const md = deltas?.get(m.id);
                  const d = (pid: string | null) => (played && m.rated && pid ? md?.get(pid) : undefined);
                  const canEnter = admin && tournamentActive && m.status === "PENDING" && !!m.player1_id && !!m.player2_id;
                  const canCorrect = admin && tournamentActive && played;
                  const bye = m.status === "PENDING" && (!m.player1_id || !m.player2_id);
                  return (
                    <div key={m.id} className={`card divide-y divide-border p-0 ${m.status === "CANCELLED" ? "opacity-50" : ""}`}>
                      <Slot id={m.player1_id} names={names} winner={p1Win} sets={s(m.player1_id)} played={played} delta={d(m.player1_id)} />
                      <Slot id={m.player2_id} names={names} winner={p2Win} sets={s(m.player2_id)} played={played} delta={d(m.player2_id)} />
                      {played && (
                        <div className="flex items-center justify-between px-3 py-1 text-[11px] text-muted">
                          <span>
                            Сыграно · {m.winner_sets}:{m.loser_sets}
                          </span>
                          <span>{m.rated === false ? "без рейтинга" : "с рейтингом"}</span>
                        </div>
                      )}
                      {m.status === "CANCELLED" && <div className="px-3 py-1 text-[11px] text-muted">отменён</div>}
                      {bye && !admin && <div className="px-3 py-1 text-[11px] text-muted">ожидает соперника</div>}
                      {(canEnter || canCorrect) && (
                        <div className="p-2">
                          <MatchResultForm
                            key={`${m.id}-${canCorrect ? "correct" : "confirm"}`}
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
