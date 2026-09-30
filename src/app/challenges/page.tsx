import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/ui";
import { ChallengeCard } from "@/components/challenge/ChallengeCard";
import { CHALLENGE_SELECT } from "@/lib/queries/challenges";

export default async function ChallengesPage() {
  const ctx = await requireMember();
  if (!ctx.player) redirect("/admin/challenges");
  const db = await createClient();
  const me = ctx.player.id;

  const { data } = await db
    .from("challenges")
    .select(CHALLENGE_SELECT)
    .or(`challenger_id.eq.${me},opponent_id.eq.${me}`)
    .order("proposed_at", { ascending: false })
    .limit(100);
  const all = data ?? [];

  const incoming = all.filter((c) => c.status === "PENDING" && c.opponent.id === me);
  const outgoing = all.filter((c) => c.status === "PENDING" && c.challenger.id === me);
  const toConfirm = all.filter((c) => c.status === "RESULT_SUBMITTED" && c.submitted_by !== me);
  const active = all.filter((c) => c.status === "ACCEPTED" || (c.status === "RESULT_SUBMITTED" && c.submitted_by === me));
  const history = all.filter((c) => ["COMPLETED", "DECLINED", "CANCELLED", "EXPIRED"].includes(c.status));

  const Section = ({ title, items, hint }: { title: string; items: typeof all; hint?: string }) =>
    items.length === 0 ? null : (
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">{title}</h2>
        {hint && <p className="mb-3 text-sm text-muted">{hint}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((c) => <ChallengeCard key={c.id} c={c} meId={me} tz={ctx.club.timezone} href={`/challenges/${c.id}`} />)}
        </div>
      </section>
    );

  return (
    <AppShell ctx={ctx}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageTitle sub="Вызовите любого игрока клуба на матч. Результат подтверждает соперник.">Челленджи</PageTitle>
        <Link href="/challenges/new" className="btn-primary shrink-0">+ Бросить вызов</Link>
      </div>
      {all.length === 0 && <div className="card text-sm text-muted">Вызовов пока нет. Начните первый!</div>}
      <Section title="Подтвердите результат" items={toConfirm} hint="Соперник внёс счёт — проверьте и подтвердите." />
      <Section title="Входящие" items={incoming} />
      <Section title="Предстоящие матчи" items={active} />
      <Section title="Исходящие" items={outgoing} />
      <Section title="История" items={history} />
    </AppShell>
  );
}
