import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";
import { ChallengeCard } from "@/components/challenge/ChallengeCard";
import { CHALLENGE_SELECT } from "@/lib/queries/challenges";

export default async function AdminChallengesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireAdmin();
  const { status = "" } = await searchParams;
  const db = await createClient();

  let q = db.from("challenges").select(CHALLENGE_SELECT).eq("club_id", ctx.club.id).order("updated_at", { ascending: false }).limit(200);
  if (status === "open") q = q.in("status", ["PENDING", "ACCEPTED", "RESULT_SUBMITTED"]);
  else if (status === "submitted") q = q.eq("status", "RESULT_SUBMITTED");
  else if (status === "completed") q = q.eq("status", "COMPLETED");
  const { data } = await q;
  const rows = data ?? [];

  const Tab = ({ v, label }: { v: string; label: string }) => (
    <a href={`/admin/challenges${v ? `?status=${v}` : ""}`} className={`rounded-lg px-3 py-1.5 text-sm ${status === v ? "bg-border/60 font-medium" : "hover:bg-border/40"}`}>{label}</a>
  );

  return (
    <>
      <PageTitle>Челленджи</PageTitle>
      <div className="mb-4 flex gap-1">
        <Tab v="" label="Все" /><Tab v="open" label="Открытые" /><Tab v="submitted" label="На подтверждении" /><Tab v="completed" label="Сыгранные" />
      </div>
      {rows.length === 0 ? (
        <div className="card text-sm text-muted">Ничего нет.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => <ChallengeCard key={c.id} c={c} tz={ctx.club.timezone} href={`/challenges/${c.id}`} />)}
        </div>
      )}
    </>
  );
}
