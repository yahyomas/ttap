import Link from "next/link";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/ui";
import { markNotificationsRead } from "@/lib/actions/challenges";

export default async function NotificationsPage() {
  const ctx = await requireMember();
  const db = await createClient();
  const { data } = await db.from("notifications").select("*").eq("user_id", ctx.userId!).order("created_at", { ascending: false }).limit(100);
  const rows = data ?? [];
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <AppShell ctx={ctx}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageTitle>Уведомления</PageTitle>
        {unread > 0 && (
          <form action={markNotificationsRead}><button className="btn-secondary">Отметить все прочитанными</button></form>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="card text-sm text-muted">Пока пусто.</div>
      ) : (
        <ul className="card divide-y divide-border p-0">
          {rows.map((n) => (
            <li key={n.id} className={`px-5 py-3 ${n.read_at ? "" : "bg-accent/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-sm ${n.read_at ? "" : "font-semibold"}`}>
                    {n.link ? <Link href={n.link} className="hover:underline">{n.title}</Link> : n.title}
                  </div>
                  {n.body && <div className="text-sm text-muted">{n.body}</div>}
                </div>
                <div className="shrink-0 text-xs text-muted">
                  {new Date(n.created_at).toLocaleString("ru-RU", { timeZone: ctx.club.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
