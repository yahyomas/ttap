import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Hand, PlayerStatusBadge, Rating, RatingStatusBadge, VerificationBadge } from "@/components/ui";
import { RatingHistory } from "@/components/RatingHistory";
import { approvePlayer, setPlayerBlocked, verifyExternalRating } from "@/lib/actions/admin";
import { AdjustRatingForm } from "./AdjustRatingForm";
import { BlockForm } from "./BlockForm";

export default async function AdminPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: player }, { data: ext }, { data: history }, { data: user }] = await Promise.all([
    supabase.from("players").select("*").eq("id", id).eq("club_id", ctx.club.id).maybeSingle(),
    supabase.from("player_external_ratings").select("*").eq("player_id", id),
    supabase
      .from("rating_transactions")
      .select("id, rating_before, rating_delta, rating_after, reason, created_at, note, calc")
      .eq("player_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("players").select("user_id").eq("id", id).maybeSingle(),
  ]);
  if (!player) notFound();
  void user;

  const tz = ctx.club.timezone;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{player.display_name}</h1>
          <div className="mt-1 text-sm text-muted">{player.first_name} {player.last_name}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PlayerStatusBadge value={player.status} />
            <RatingStatusBadge value={player.rating_status} />
            <span className="text-sm text-muted"><Hand value={player.playing_hand} /> рука</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted">Club Rating</div>
          <div className="text-3xl font-semibold"><Rating value={player.current_rating} /></div>
          <div className="text-xs text-muted">пик: <Rating value={player.peak_rating} /> · турниров: {player.tournament_count}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-semibold">Профиль</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-sm">
            <dt className="text-muted">Дата рождения</dt><dd>{player.birth_date ?? "—"}</dd>
            <dt className="text-muted">Пол</dt><dd>{player.gender === "MALE" ? "Мужской" : player.gender === "FEMALE" ? "Женский" : "—"}</dd>
            <dt className="text-muted">Регистрация</dt><dd>{new Date(player.created_at).toLocaleString("ru-RU", { timeZone: tz })}</dd>
            <dt className="text-muted">Одобрен</dt><dd>{player.approved_at ? new Date(player.approved_at).toLocaleString("ru-RU", { timeZone: tz }) : "—"}</dd>
            {player.blocked_at && (<><dt className="text-muted">Заблокирован</dt><dd>{new Date(player.blocked_at).toLocaleString("ru-RU", { timeZone: tz })} — {player.blocked_reason}</dd></>)}
          </dl>

          <div className="flex flex-wrap gap-2 pt-2">
            {player.status === "PENDING" && (
              <form action={approvePlayer.bind(null, player.id)}>
                <button className="btn-primary">Одобрить игрока</button>
              </form>
            )}
            {player.status === "BLOCKED" ? (
              <form action={setPlayerBlocked.bind(null, player.id, false, undefined)}>
                <button className="btn-secondary">Разблокировать</button>
              </form>
            ) : (
              <BlockForm playerId={player.id} />
            )}
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold">Внешние рейтинги</h2>
          {(ext ?? []).length === 0 && <div className="text-sm text-muted">Игрок не указывал внешний рейтинг.</div>}
          {(ext ?? []).map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <div>
                <b>{e.source}</b>: {e.rating} <VerificationBadge value={e.status} />
                {e.verified_at && <div className="text-xs text-muted">{new Date(e.verified_at).toLocaleString("ru-RU", { timeZone: tz })}</div>}
              </div>
              {e.status === "PENDING" && (
                <div className="flex gap-2">
                  <form action={verifyExternalRating.bind(null, e.id, "VERIFIED", player.id)}>
                    <button className="btn-primary px-3 py-1 text-xs">Подтвердить</button>
                  </form>
                  <form action={verifyExternalRating.bind(null, e.id, "REJECTED", player.id)}>
                    <button className="btn-secondary px-3 py-1 text-xs">Отклонить</button>
                  </form>
                </div>
              )}
            </div>
          ))}
          <p className="text-xs text-muted">
            Политика клуба: подтверждённый RTTF инициализирует Club Rating (статус «Предварительный»), если рейтинга ещё нет.
          </p>
        </div>

        <div className="card md:col-span-2">
          <h2 className="mb-3 font-semibold">Ручная корректировка рейтинга</h2>
          <AdjustRatingForm playerId={player.id} current={player.current_rating} />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">История рейтинга</h2>
        <RatingHistory rows={history ?? []} timezone={tz} />
      </section>
    </>
  );
}
