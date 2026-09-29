import Link from "next/link";
import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Hand, PageTitle, Rating, RatingStatusBadge } from "@/components/ui";

export default async function LeaderboardPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("club_id", ctx.club.id)
    .order("rank", { ascending: true })
    .limit(200);

  return (
    <AppShell ctx={ctx}>
      <PageTitle sub="Клубный рейтинг. Новички без рейтинга появятся здесь после первого турнира.">
        Рейтинг клуба
      </PageTitle>

      {rows && rows.length > 0 ? (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Игрок</th>
                <th className="px-5 py-3 text-right">Рейтинг</th>
                <th className="px-5 py-3">Статус</th>
                <th className="px-5 py-3">Рука</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.player_id} className={r.player_id === ctx.player?.id ? "bg-accent/5" : ""}>
                  <td className="px-5 py-3 tabular-nums text-muted">{r.rank}</td>
                  <td className="px-5 py-3">
                    <Link href={`/players/${r.player_id}`} className="font-medium hover:underline">
                      {r.display_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold"><Rating value={r.current_rating} /></td>
                  <td className="px-5 py-3"><RatingStatusBadge value={r.rating_status!} /></td>
                  <td className="px-5 py-3 text-muted"><Hand value={r.playing_hand!} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-sm text-muted">В клубе пока нет игроков с рейтингом.</div>
      )}
    </AppShell>
  );
}
