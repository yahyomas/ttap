import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Rating, RatingStatusBadge } from "@/components/ui";
import { ChallengeStatusBadge } from "@/components/challenge/ChallengeCard";
import { CHALLENGE_SELECT, fmtDateTime } from "@/lib/queries/challenges";
import { cancelChallenge, respondChallenge } from "@/lib/actions/challenges";
import { ChallengeActions } from "./ChallengeActions";

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMember();
  const { id } = await params;
  const db = await createClient();
  const { data: c } = await db.from("challenges").select(CHALLENGE_SELECT).eq("id", id).maybeSingle();
  if (!c) notFound();
  const me = ctx.player?.id;
  const tz = ctx.club.timezone;
  const isParty = me === c.challenger.id || me === c.opponent.id;
  const confirmHours = ((ctx.club.settings as { challenges?: { confirm_hours?: number } })?.challenges?.confirm_hours) ?? 48;
  const timeoutAt = c.submitted_at ? new Date(new Date(c.submitted_at).getTime() + confirmHours * 3600 * 1000) : null;
  const timeoutPassed = !!timeoutAt && timeoutAt <= new Date();

  const submitter = c.submitted_by === c.challenger.id ? c.challenger : c.submitted_by === c.opponent.id ? c.opponent : null;
  const winner = c.match?.winner_player_id === c.challenger.id ? c.challenger : c.match?.winner_player_id === c.opponent.id ? c.opponent : null;

  // rating impact
  const { data: txs } = c.status === "COMPLETED" && c.match_id
    ? await db.from("rating_transactions").select("player_id, rating_delta").eq("match_id", c.match_id)
    : { data: [] as { player_id: string; rating_delta: number }[] };
  const delta = new Map((txs ?? []).map((t) => [t.player_id, t.rating_delta]));

  const Side = ({ p, label }: { p: typeof c.challenger; label: string }) => (
    <div className={`card flex-1 ${winner?.id === p.id ? "border-emerald-500/60" : ""}`}>
      <div className="text-xs uppercase text-muted">{label}</div>
      <Link href={`/players/${p.id}`} className="mt-1 block text-lg font-semibold hover:underline">{p.display_name}{winner?.id === p.id && " 🏆"}</Link>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className="tabular-nums"><Rating value={p.current_rating} /></span>
        <RatingStatusBadge value={p.rating_status} />
        {delta.has(p.id) && (
          <span className={`font-medium ${delta.get(p.id)! >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {delta.get(p.id)! >= 0 ? "+" : ""}{Math.floor(delta.get(p.id)! + 0.5)}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <AppShell ctx={ctx}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/challenges" className="text-sm text-muted hover:underline">← Челленджи</Link>
          <h1 className="mt-1 text-2xl font-semibold">Вызов</h1>
        </div>
        <ChallengeStatusBadge value={c.status} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Side p={c.challenger} label="Вызвал" />
        <div className="flex items-center justify-center text-2xl text-muted">vs</div>
        <Side p={c.opponent} label="Соперник" />
      </div>

      <div className="card mb-4 space-y-1 text-sm">
        <div><span className="text-muted">Когда:</span> {fmtDateTime(c.proposed_at, tz)}</div>
        {c.message && <div><span className="text-muted">Сообщение:</span> {c.message}</div>}
        {c.match?.winner_player_id && (
          <div>
            <span className="text-muted">Счёт:</span> {winner?.display_name} выиграл <b>{c.match.winner_sets}:{c.match.loser_sets}</b>
            {submitter && c.status === "RESULT_SUBMITTED" && <span className="text-muted"> · внёс {submitter.display_name}</span>}
            {c.match.rated === false && c.status === "COMPLETED" && <span className="ml-1 text-xs text-muted">(без рейтинга)</span>}
          </div>
        )}
        {c.dispute_note && c.status === "ACCEPTED" && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700">
            Результат был отклонён: «{c.dispute_note}». Внесите счёт заново.
          </div>
        )}
        {c.status === "RESULT_SUBMITTED" && timeoutAt && (
          <div className="text-xs text-muted">
            {timeoutPassed ? "Срок подтверждения соперником истёк." : `Если соперник не ответит до ${fmtDateTime(timeoutAt.toISOString(), tz)}, результат сможет подтвердить внёсший.`}
          </div>
        )}
      </div>

      {(isParty || ctx.isAdmin) && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Действия</h2>
          {c.status === "PENDING" && me === c.opponent.id && (
            <div className="flex gap-2">
              <form action={respondChallenge.bind(null, c.id, true)}><button className="btn-primary">Принять</button></form>
              <form action={respondChallenge.bind(null, c.id, false)}><button className="btn-secondary">Отклонить</button></form>
            </div>
          )}
          {c.status === "PENDING" && me === c.challenger.id && (
            <form action={cancelChallenge.bind(null, c.id, undefined)}><button className="btn-secondary">Отозвать вызов</button></form>
          )}
          {(c.status === "ACCEPTED" || (c.status === "RESULT_SUBMITTED" && c.submitted_by === me)) && isParty && (
            <ChallengeActions
              mode="submit"
              challengeId={c.id}
              challenger={{ id: c.challenger.id, name: c.challenger.display_name }}
              opponent={{ id: c.opponent.id, name: c.opponent.display_name }}
              canTimeoutConfirm={c.status === "RESULT_SUBMITTED" && timeoutPassed}
              allowCancel={c.status === "ACCEPTED"}
            />
          )}
          {c.status === "RESULT_SUBMITTED" && (c.submitted_by !== me && isParty || ctx.isAdmin && !isParty) && (
            <ChallengeActions mode="confirm" challengeId={c.id} challenger={{ id: c.challenger.id, name: c.challenger.display_name }} opponent={{ id: c.opponent.id, name: c.opponent.display_name }} isAdmin={ctx.isAdmin && !isParty} />
          )}
          {ctx.isAdmin && !isParty && ["PENDING", "ACCEPTED", "RESULT_SUBMITTED"].includes(c.status) && (
            <form action={cancelChallenge.bind(null, c.id, "отменено администратором")} className="mt-3">
              <button className="text-xs text-muted hover:text-red-600">Отменить как администратор</button>
            </form>
          )}
          {["COMPLETED", "DECLINED", "CANCELLED", "EXPIRED"].includes(c.status) && (
            <p className="text-sm text-muted">Вызов закрыт.{isParty && c.status !== "COMPLETED" && <> <Link href={`/challenges/new?opponent=${me === c.challenger.id ? c.opponent.id : c.challenger.id}`} className="text-accent underline">Бросить новый</Link></>}</p>
          )}
        </div>
      )}
    </AppShell>
  );
}
