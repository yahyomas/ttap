import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Hand, PageTitle, PlayerStatusBadge, Rating, RatingStatusBadge, VerificationBadge } from "@/components/ui";
import { approvePlayer } from "@/lib/actions/admin";

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; hand?: string; rttf?: string }>;
}) {
  const ctx = await requireAdmin();
  const { q = "", status = "", hand = "", rttf = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("players")
    .select("id, display_name, first_name, last_name, playing_hand, status, current_rating, rating_status, tournament_count, created_at, player_external_ratings(id, rating, status)")
    .eq("club_id", ctx.club.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (q) query = query.or(`display_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  if (status === "PENDING" || status === "ACTIVE" || status === "BLOCKED") query = query.eq("status", status);
  if (hand === "RIGHT" || hand === "LEFT") query = query.eq("playing_hand", hand);

  const { data } = await query.limit(300);
  const players = (data ?? []).filter((p) =>
    rttf === "PENDING" ? p.player_external_ratings.some((e) => e.status === "PENDING") : true,
  );

  return (
    <>
      <PageTitle>Игроки</PageTitle>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Поиск" className="input max-w-xs" />
        <select name="status" defaultValue={status} className="input max-w-[180px]">
          <option value="">Любой статус</option>
          <option value="PENDING">Ожидают</option>
          <option value="ACTIVE">Активные</option>
          <option value="BLOCKED">Заблокированные</option>
        </select>
        <select name="hand" defaultValue={hand} className="input max-w-[140px]">
          <option value="">Любая рука</option>
          <option value="RIGHT">Правая</option>
          <option value="LEFT">Левая</option>
        </select>
        <select name="rttf" defaultValue={rttf} className="input max-w-[180px]">
          <option value="">RTTF: все</option>
          <option value="PENDING">RTTF на проверке</option>
        </select>
        <button className="btn-secondary">Фильтр</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Игрок</th>
              <th className="px-4 py-3 text-right">Club</th>
              <th className="px-4 py-3">RTTF</th>
              <th className="px-4 py-3">Рука</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Рейтинг</th>
              <th className="px-4 py-3">Регистрация</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {players.map((p) => {
              const ext = p.player_external_ratings[0];
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/players/${p.id}`} className="font-medium hover:underline">{p.display_name}</Link>
                    <div className="text-xs text-muted">{p.first_name} {p.last_name}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold"><Rating value={p.current_rating} /></td>
                  <td className="px-4 py-3">
                    {ext ? <span className="inline-flex items-center gap-1">{ext.rating} <VerificationBadge value={ext.status} /></span> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted"><Hand value={p.playing_hand} /></td>
                  <td className="px-4 py-3"><PlayerStatusBadge value={p.status} /></td>
                  <td className="px-4 py-3"><RatingStatusBadge value={p.rating_status} /></td>
                  <td className="px-4 py-3 text-muted">{new Date(p.created_at).toLocaleDateString("ru-RU", { timeZone: ctx.club.timezone })}</td>
                  <td className="px-4 py-3 text-right">
                    {p.status === "PENDING" && (
                      <form action={approvePlayer.bind(null, p.id)}>
                        <button className="btn-primary px-3 py-1 text-xs">Одобрить</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {players.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted">Никого не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
