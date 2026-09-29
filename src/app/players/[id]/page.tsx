import { notFound } from "next/navigation";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Hand, Rating, RatingStatusBadge } from "@/components/ui";
import { RatingHistory } from "@/components/RatingHistory";

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMember();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: player }, { data: rank }, { data: history }, { data: stats }] = await Promise.all([
    supabase.from("players").select("*").eq("id", id).eq("club_id", ctx.club.id).maybeSingle(),
    supabase.from("leaderboard").select("rank").eq("player_id", id).maybeSingle(),
    supabase
      .from("rating_transactions")
      .select("id, rating_before, rating_delta, rating_after, reason, created_at")
      .eq("player_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("player_match_stats").select("wins, losses").eq("player_id", id).maybeSingle(),
  ]);
  if (!player) notFound();

  const showHand =
    ((ctx.club.settings as { privacy?: { show_playing_hand?: boolean } })?.privacy?.show_playing_hand ?? true);

  return (
    <AppShell ctx={ctx}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{player.display_name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted">
            <RatingStatusBadge value={player.rating_status} />
            {showHand && <span><Hand value={player.playing_hand} /> рука</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted">Club Rating</div>
          <div className="text-3xl font-semibold"><Rating value={player.current_rating} /></div>
          {rank?.rank && <div className="text-sm text-muted">#{rank.rank} в клубе</div>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card"><div className="text-sm text-muted">Пик рейтинга</div><div className="mt-1 text-2xl font-semibold"><Rating value={player.peak_rating} /></div></div>
        <div className="card"><div className="text-sm text-muted">Турниров</div><div className="mt-1 text-2xl font-semibold">{player.tournament_count}</div></div>
        <div className="card"><div className="text-sm text-muted">W / L</div><div className="mt-1 text-2xl font-semibold tabular-nums">{stats?.wins ?? 0} / {stats?.losses ?? 0}</div></div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">История рейтинга</h2>
        <RatingHistory rows={history ?? []} timezone={ctx.club.timezone} />
      </section>
    </AppShell>
  );
}
