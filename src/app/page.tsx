import Link from "next/link";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Rating, RatingStatusBadge } from "@/components/ui";

export default async function DashboardPage() {
  const ctx = await requireMember();
  const supabase = await createClient();

  const [{ data: rankRow }, { count: playersCount }, { data: recentTx }] = await Promise.all([
    ctx.player
      ? supabase.from("leaderboard").select("rank").eq("player_id", ctx.player.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("club_id", ctx.club.id)
      .eq("status", "ACTIVE"),
    ctx.player
      ? supabase
          .from("rating_transactions")
          .select("id, rating_delta, reason, created_at")
          .eq("player_id", ctx.player.id)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const p = ctx.player;

  return (
    <AppShell ctx={ctx}>
      <h1 className="mb-6 text-2xl font-semibold">
        Привет, {p?.display_name ?? ctx.email}
      </h1>

      {p ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card">
            <div className="text-sm text-muted">Club Rating</div>
            <div className="mt-1 text-3xl font-semibold"><Rating value={p.current_rating} /></div>
            <div className="mt-2"><RatingStatusBadge value={p.rating_status} /></div>
          </div>
          <div className="card">
            <div className="text-sm text-muted">Место в клубе</div>
            <div className="mt-1 text-3xl font-semibold">
              {rankRow?.rank ? `#${rankRow.rank}` : "—"}
            </div>
            <div className="mt-2 text-xs text-muted">из {playersCount ?? 0} активных игроков</div>
          </div>
          <div className="card">
            <div className="text-sm text-muted">Турниров сыграно</div>
            <div className="mt-1 text-3xl font-semibold">{p.tournament_count}</div>
            <div className="mt-2 text-xs text-muted">
              {p.rating_status === "NEW" ? "Рейтинг появится после первого турнира" : " "}
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-sm text-muted">
          Вы администратор без игрового профиля. Перейдите в{" "}
          <Link href="/admin" className="text-accent underline">админку</Link>.
        </div>
      )}

      {p && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Последние изменения рейтинга</h2>
          {recentTx && recentTx.length > 0 ? (
            <ul className="card divide-y divide-border p-0">
              {recentTx.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-muted">
                    {new Date(t.created_at).toLocaleDateString("ru-RU", { timeZone: ctx.club.timezone })}
                  </span>
                  <span>{REASON_LABEL[t.reason] ?? t.reason}</span>
                  <span className={`tabular-nums font-medium ${t.rating_delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {t.rating_delta >= 0 ? "+" : ""}
                    {Math.floor(t.rating_delta + 0.5)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card text-sm text-muted">Пока нет изменений. Сыграйте первый турнир.</div>
          )}
        </section>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="text-sm text-muted">Пятничный турнир</div>
          <div className="mt-1 font-medium">Скоро · Phase 4</div>
        </div>
        <div className="card">
          <div className="text-sm text-muted">Челленджи</div>
          <div className="mt-1 font-medium">Скоро · Phase 3</div>
        </div>
      </section>
    </AppShell>
  );
}

const REASON_LABEL: Record<string, string> = {
  TOURNAMENT_MATCH: "Турнирный матч",
  CHALLENGE_MATCH: "Челлендж",
  CASUAL_MATCH: "Товарищеский матч",
  NEWCOMER_INITIAL: "Стартовый рейтинг",
  EXTERNAL_SEED: "Инициализация из RTTF",
  MANUAL_ADJUSTMENT: "Корректировка админом",
  REVERSAL: "Отмена",
};
