import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { TournamentCard } from "@/components/tournament/TournamentCard";
import { CreateTournamentForm } from "./CreateTournamentForm";

export default async function AdminTournamentsPage() {
  const ctx = await requireAdmin();
  const db = await createClient();
  const { data: list } = await db
    .from("tournaments")
    .select("*")
    .eq("club_id", ctx.club.id)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })
    .limit(100);

  const { data: counts } = await db
    .from("tournament_participants")
    .select("tournament_id")
    .eq("club_id", ctx.club.id)
    .eq("status", "REGISTERED");
  const countBy = new Map<string, number>();
  for (const c of counts ?? []) countBy.set(c.tournament_id, (countBy.get(c.tournament_id) ?? 0) + 1);

  // Next Friday 19:00 as default
  const now = new Date();
  const fridayOffset = (5 - now.getDay() + 7) % 7 || 7;
  const nextFriday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + fridayOffset, 19, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultStart = `${nextFriday.getFullYear()}-${pad(nextFriday.getMonth() + 1)}-${pad(nextFriday.getDate())}T19:00`;

  return (
    <>
      <PageTitle>Турниры</PageTitle>
      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {(list ?? []).length === 0 && <div className="card text-sm text-muted">Турниров пока нет — создайте первый.</div>}
          {(list ?? []).map((t) => (
            <TournamentCard
              key={t.id}
              t={t}
              tz={ctx.club.timezone}
              href={`/admin/tournaments/${t.id}`}
              extra={<span className="text-muted">{countBy.get(t.id) ?? 0} зарегистрировано</span>}
            />
          ))}
        </div>
        <div>
          <CreateTournamentForm defaultStart={defaultStart} />
        </div>
      </div>
    </>
  );
}
