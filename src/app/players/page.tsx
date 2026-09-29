import Link from "next/link";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Hand, PageTitle, Rating, RatingStatusBadge } from "@/components/ui";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hand?: string }>;
}) {
  const ctx = await requireMember();
  const { q = "", hand = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("players")
    .select("id, display_name, playing_hand, current_rating, rating_status, tournament_count")
    .eq("club_id", ctx.club.id)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .order("current_rating", { ascending: false, nullsFirst: false })
    .order("display_name");
  if (q) query = query.ilike("display_name", `%${q}%`);
  if (hand === "RIGHT" || hand === "LEFT") query = query.eq("playing_hand", hand);

  const { data: players } = await query.limit(200);

  return (
    <AppShell ctx={ctx}>
      <PageTitle>Игроки</PageTitle>

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Поиск по имени" className="input max-w-xs" />
        <select name="hand" defaultValue={hand} className="input max-w-[160px]">
          <option value="">Любая рука</option>
          <option value="RIGHT">Правая</option>
          <option value="LEFT">Левая</option>
        </select>
        <button className="btn-secondary">Найти</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-5 py-3">Игрок</th>
              <th className="px-5 py-3 text-right">Рейтинг</th>
              <th className="px-5 py-3">Статус</th>
              <th className="px-5 py-3">Рука</th>
              <th className="px-5 py-3 text-right">Турниров</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(players ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3">
                  <Link href={`/players/${p.id}`} className="font-medium hover:underline">{p.display_name}</Link>
                </td>
                <td className="px-5 py-3 text-right font-semibold"><Rating value={p.current_rating} /></td>
                <td className="px-5 py-3"><RatingStatusBadge value={p.rating_status} /></td>
                <td className="px-5 py-3 text-muted"><Hand value={p.playing_hand} /></td>
                <td className="px-5 py-3 text-right tabular-nums">{p.tournament_count}</td>
              </tr>
            ))}
            {(players ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-muted">Никого не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
