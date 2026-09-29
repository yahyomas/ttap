import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/ui";
import { TournamentCard } from "@/components/tournament/TournamentCard";

export default async function TournamentsPage() {
  const ctx = await requireMember();
  const db = await createClient();

  const { data: all } = await db
    .from("tournaments")
    .select("*")
    .eq("club_id", ctx.club.id)
    .is("deleted_at", null)
    .neq("status", "DRAFT")
    .order("starts_at", { ascending: false })
    .limit(100);

  const list = all ?? [];
  const upcoming = list.filter((t) => t.status === "REGISTRATION_OPEN" || t.status === "REGISTRATION_CLOSED").reverse();
  const active = list.filter((t) => t.status === "IN_PROGRESS");
  const finished = list.filter((t) => t.status === "COMPLETED" || t.status === "CANCELLED");

  const myRegs = ctx.player
    ? (await db.from("tournament_participants").select("tournament_id").eq("player_id", ctx.player.id).eq("status", "REGISTERED")).data ?? []
    : [];
  const mine = new Set(myRegs.map((r) => r.tournament_id));

  const Section = ({ title, items }: { title: string; items: typeof list }) =>
    items.length === 0 ? null : (
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((t) => (
            <TournamentCard
              key={t.id}
              t={t}
              tz={ctx.club.timezone}
              href={`/tournaments/${t.id}`}
              extra={mine.has(t.id) ? <span className="text-emerald-600">✓ Вы зарегистрированы</span> : undefined}
            />
          ))}
        </div>
      </section>
    );

  return (
    <AppShell ctx={ctx}>
      <PageTitle sub="Пятничный турнир — главный еженедельный формат клуба.">Турниры</PageTitle>
      {list.length === 0 && <div className="card text-sm text-muted">Турниров пока нет.</div>}
      <Section title="Идут сейчас" items={active} />
      <Section title="Ближайшие" items={upcoming} />
      <Section title="Завершённые" items={finished} />
    </AppShell>
  );
}
