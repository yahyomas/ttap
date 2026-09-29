import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";

export default async function AdminDashboard() {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const club = ctx.club.id;

  const [{ count: total }, { count: pending }, { count: blocked }, { count: pendingRttf }, { data: recent }] =
    await Promise.all([
      supabase.from("players").select("id", { count: "exact", head: true }).eq("club_id", club).eq("status", "ACTIVE").is("deleted_at", null),
      supabase.from("players").select("id", { count: "exact", head: true }).eq("club_id", club).eq("status", "PENDING").is("deleted_at", null),
      supabase.from("players").select("id", { count: "exact", head: true }).eq("club_id", club).eq("status", "BLOCKED").is("deleted_at", null),
      supabase.from("player_external_ratings").select("id", { count: "exact", head: true }).eq("club_id", club).eq("status", "PENDING"),
      supabase.from("players").select("id, display_name, status, created_at").eq("club_id", club).is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
    ]);

  const stat = (label: string, value: number | null, href?: string, highlight?: boolean) => (
    <Link href={href ?? "#"} className={`card block ${highlight && value ? "border-amber-500/60" : ""}`}>
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value ?? 0}</div>
    </Link>
  );

  return (
    <>
      <PageTitle>Dashboard</PageTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat("Активных игроков", total, "/admin/players?status=ACTIVE")}
        {stat("Ожидают одобрения", pending, "/admin/players?status=PENDING", true)}
        {stat("RTTF на проверке", pendingRttf, "/admin/players?rttf=PENDING", true)}
        {stat("Заблокировано", blocked, "/admin/players?status=BLOCKED")}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Последние регистрации</h2>
        <ul className="card divide-y divide-border p-0">
          {(recent ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <Link href={`/admin/players/${p.id}`} className="font-medium hover:underline">{p.display_name}</Link>
              <span className="text-muted">
                {p.status === "PENDING" ? "⏳ ожидает" : p.status === "BLOCKED" ? "🚫 заблокирован" : "✓ активен"} ·{" "}
                {new Date(p.created_at).toLocaleDateString("ru-RU", { timeZone: ctx.club.timezone })}
              </span>
            </li>
          ))}
          {(recent ?? []).length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Пока нет игроков</li>}
        </ul>
      </section>
    </>
  );
}
