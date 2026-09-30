import { redirect } from "next/navigation";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/ui";
import { NewChallengeForm } from "./NewChallengeForm";

export default async function NewChallengePage({ searchParams }: { searchParams: Promise<{ opponent?: string }> }) {
  const ctx = await requireMember();
  if (!ctx.player) redirect("/admin");
  const { opponent } = await searchParams;
  const db = await createClient();

  const { data: players } = await db
    .from("players")
    .select("id, display_name, current_rating, rating_status")
    .eq("club_id", ctx.club.id)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .neq("id", ctx.player.id)
    .order("current_rating", { ascending: false, nullsFirst: false })
    .order("display_name");

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const def = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T19:00`;

  return (
    <AppShell ctx={ctx}>
      <PageTitle>Новый вызов</PageTitle>
      <div className="max-w-lg">
        <NewChallengeForm
          players={(players ?? []).map((p) => ({ id: p.id, name: p.display_name, rating: p.current_rating, isNew: p.rating_status === "NEW" }))}
          defaultOpponent={opponent}
          defaultTime={def}
          meIsNew={ctx.player.rating_status === "NEW"}
        />
      </div>
    </AppShell>
  );
}
