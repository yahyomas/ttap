import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Rating, RatingStatusBadge } from "@/components/ui";
import { BracketView } from "@/components/tournament/BracketView";
import { TournamentStatusBadge, fmtDate } from "@/components/tournament/TournamentCard";
import { loadTournamentDetail } from "@/lib/queries/tournaments";
import { removeParticipant, setTournamentStatus } from "@/lib/actions/tournaments";
import { LockBracketButton, CompleteTournamentButton } from "./Controls";

export default async function AdminTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  const { id } = await params;
  const db = await createClient();
  const d = await loadTournamentDetail(db, id, ctx.club.id);
  if (!d) notFound();
  const { tournament: t, participants, registered, matches, rounds, names } = d;
  const tz = ctx.club.timezone;

  const pending = matches.filter((m) => m.status === "PENDING").length;
  const confirmed = matches.filter((m) => m.status === "CONFIRMED").length;
  const canComplete = t.status === "IN_PROGRESS" && matches.length > 0 && pending === 0;

  const { data: txs } = await db
    .from("rating_transactions")
    .select("player_id, rating_delta, reason")
    .eq("tournament_id", t.id);
  const deltaBy = new Map<string, number>();
  for (const x of txs ?? []) deltaBy.set(x.player_id, (deltaBy.get(x.player_id) ?? 0) + x.rating_delta);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t.name}</h1>
          <div className="mt-1 text-sm text-muted">{fmtDate(t.starts_at, tz)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <TournamentStatusBadge value={t.status} />
            <span className="text-muted">{registered.length} участник(ов)</span>
            {t.bracket_size && <span className="text-muted">· сетка на {t.bracket_size}</span>}
            {t.average_rating !== null && <span className="text-muted">· ср. рейтинг {Math.round(t.average_rating)} · k = {t.k}</span>}
            <Link href={`/tournaments/${t.id}`} className="text-accent underline">Публичная страница</Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {t.status === "DRAFT" && (
            <form action={setTournamentStatus.bind(null, t.id, "REGISTRATION_OPEN")}><button className="btn-primary">Открыть регистрацию</button></form>
          )}
          {t.status === "REGISTRATION_OPEN" && (
            <form action={setTournamentStatus.bind(null, t.id, "REGISTRATION_CLOSED")}><button className="btn-secondary">Закрыть регистрацию</button></form>
          )}
          {t.status === "REGISTRATION_CLOSED" && (
            <form action={setTournamentStatus.bind(null, t.id, "REGISTRATION_OPEN")}><button className="btn-secondary">Открыть снова</button></form>
          )}
          {(t.status === "REGISTRATION_OPEN" || t.status === "REGISTRATION_CLOSED") && (
            <LockBracketButton tournamentId={t.id} count={registered.length} />
          )}
          {t.status === "IN_PROGRESS" && (
            <CompleteTournamentButton tournamentId={t.id} disabled={!canComplete} pending={pending} />
          )}
          {t.status !== "COMPLETED" && t.status !== "CANCELLED" && (
            <form action={setTournamentStatus.bind(null, t.id, "CANCELLED")}>
              <button className="btn-secondary text-red-600">Отменить турнир</button>
            </form>
          )}
        </div>
      </div>

      {(t.status === "IN_PROGRESS" || t.status === "COMPLETED") && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Сетка</h2>
            <span className="text-sm text-muted">{confirmed} сыграно · {pending} ожидает</span>
          </div>
          <BracketView matches={matches} rounds={rounds} names={names} admin tournamentId={t.id} tournamentActive={t.status === "IN_PROGRESS"} />
          <p className="mt-2 text-xs text-muted">
            Дельты считаются от рейтингов на момент фиксации сетки. Матч с новичком без рейтинга — без изменения рейтинга; новичок получит стартовый рейтинг при завершении турнира.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Участники</h2>
        {participants.length === 0 ? (
          <div className="card text-sm text-muted">Пока никто не зарегистрировался.</div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">{t.locked_at ? "Сид" : "#"}</th>
                  <th className="px-4 py-2">Игрок</th>
                  <th className="px-4 py-2">Статус</th>
                  <th className="px-4 py-2 text-right">{t.locked_at ? "На старте" : "Рейтинг"}</th>
                  <th className="px-4 py-2 text-right">Сейчас</th>
                  <th className="px-4 py-2 text-right">Δ</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {participants.map((p, i) => {
                  const delta = deltaBy.get(p.player_id);
                  return (
                    <tr key={p.id} className={p.status !== "REGISTERED" ? "opacity-50" : ""}>
                      <td className="px-4 py-2 tabular-nums text-muted">{p.seed ?? i + 1}</td>
                      <td className="px-4 py-2">
                        <Link href={`/admin/players/${p.player_id}`} className="font-medium hover:underline">{p.players.display_name}</Link>
                        {p.final_place === 1 && " 🏆"}{p.final_place === 2 && " 🥈"}
                        <span className="ml-2"><RatingStatusBadge value={p.rating_status_at_lock ?? p.players.rating_status} /></span>
                      </td>
                      <td className="px-4 py-2 text-muted">{p.status === "REGISTERED" ? "участвует" : p.status === "WITHDRAWN" ? "снят" : "не явился"}</td>
                      <td className="px-4 py-2 text-right tabular-nums"><Rating value={t.locked_at ? p.rating_at_lock : p.players.current_rating} /></td>
                      <td className="px-4 py-2 text-right tabular-nums"><Rating value={p.players.current_rating} /></td>
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${delta === undefined ? "text-muted" : delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {delta === undefined ? "—" : `${delta >= 0 ? "+" : ""}${Math.floor(delta + 0.5)}`}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {p.status === "REGISTERED" && !t.locked_at && (
                          <form action={removeParticipant.bind(null, p.id, t.id)}>
                            <button className="text-xs text-muted hover:text-red-600">Снять</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
