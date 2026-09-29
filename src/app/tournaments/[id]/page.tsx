import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Rating, RatingStatusBadge } from "@/components/ui";
import { BracketView } from "@/components/tournament/BracketView";
import { TournamentStatusBadge, fmtDate } from "@/components/tournament/TournamentCard";
import { loadTournamentDetail } from "@/lib/queries/tournaments";
import { registerForTournament, withdrawFromTournament } from "@/lib/actions/tournaments";

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMember();
  const { id } = await params;
  const db = await createClient();
  const d = await loadTournamentDetail(db, id, ctx.club.id);
  if (!d) notFound();
  const { tournament: t, registered, matches, rounds, names } = d;
  const tz = ctx.club.timezone;

  const me = ctx.player ? registered.find((p) => p.player_id === ctx.player!.id) : undefined;
  const canRegister =
    !!ctx.player && !me && t.status === "REGISTRATION_OPEN" &&
    (!t.registration_deadline || new Date(t.registration_deadline) > new Date()) &&
    (!t.max_participants || registered.length < t.max_participants);
  const canWithdraw = !!me && (t.status === "REGISTRATION_OPEN" || t.status === "REGISTRATION_CLOSED");

  // rating impact for completed tournaments
  const { data: impact } = t.status === "COMPLETED"
    ? await db.from("rating_transactions").select("player_id, rating_delta, reason").eq("tournament_id", t.id)
    : { data: [] as { player_id: string; rating_delta: number; reason: string }[] };
  const deltaBy = new Map<string, number>();
  for (const x of impact ?? []) deltaBy.set(x.player_id, (deltaBy.get(x.player_id) ?? 0) + x.rating_delta);

  return (
    <AppShell ctx={ctx}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t.name}</h1>
          <div className="mt-1 text-sm text-muted">{fmtDate(t.starts_at, tz)}</div>
          {t.description && <p className="mt-2 max-w-prose text-sm">{t.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <TournamentStatusBadge value={t.status} />
            <span className="text-muted">{registered.length} участник(ов){t.max_participants ? ` из ${t.max_participants}` : ""}</span>
            {t.average_rating !== null && <span className="text-muted">· средний рейтинг {Math.round(t.average_rating)} · k = {t.k}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {t.winner_player_id && (
            <div className="text-right">
              <div className="text-xs text-muted">Чемпион</div>
              <div className="text-lg font-semibold">🏆 {names.get(t.winner_player_id)}</div>
            </div>
          )}
          {canRegister && (
            <form action={registerForTournament.bind(null, t.id)}>
              <button className="btn-primary">Зарегистрироваться</button>
            </form>
          )}
          {me && <span className="text-sm text-emerald-600">✓ Вы зарегистрированы{me.seed ? ` · сид #${me.seed}` : ""}</span>}
          {canWithdraw && (
            <form action={withdrawFromTournament.bind(null, t.id)}>
              <button className="text-xs text-muted hover:text-red-600">Отменить регистрацию</button>
            </form>
          )}
          {ctx.isAdmin && <Link href={`/admin/tournaments/${t.id}`} className="text-xs text-accent underline">Управление</Link>}
        </div>
      </div>

      {t.status === "IN_PROGRESS" || t.status === "COMPLETED" ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Сетка</h2>
          <BracketView matches={matches} rounds={rounds} names={names} tournamentId={t.id} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Участники</h2>
        {registered.length === 0 ? (
          <div className="card text-sm text-muted">Пока никто не зарегистрировался.</div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">{t.locked_at ? "Сид" : "#"}</th>
                  <th className="px-4 py-2">Игрок</th>
                  <th className="px-4 py-2 text-right">{t.locked_at ? "Рейтинг на старте" : "Рейтинг"}</th>
                  {t.status === "COMPLETED" && <th className="px-4 py-2 text-right">Δ за турнир</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {registered.map((p, i) => {
                  const delta = deltaBy.get(p.player_id);
                  return (
                    <tr key={p.id} className={p.player_id === ctx.player?.id ? "bg-accent/5" : ""}>
                      <td className="px-4 py-2 tabular-nums text-muted">{p.seed ?? i + 1}</td>
                      <td className="px-4 py-2">
                        <Link href={`/players/${p.player_id}`} className="font-medium hover:underline">{p.players.display_name}</Link>
                        {p.final_place === 1 && " 🏆"}
                        {p.final_place === 2 && " 🥈"}
                        <span className="ml-2"><RatingStatusBadge value={p.rating_status_at_lock ?? p.players.rating_status} /></span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums"><Rating value={t.locked_at ? p.rating_at_lock : p.players.current_rating} /></td>
                      {t.status === "COMPLETED" && (
                        <td className={`px-4 py-2 text-right tabular-nums font-medium ${delta === undefined ? "text-muted" : delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {delta === undefined ? "—" : `${delta >= 0 ? "+" : ""}${Math.floor(delta + 0.5)}`}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
