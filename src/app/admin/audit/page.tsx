import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui";

export default async function AuditPage() {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("club_id", ctx.club.id)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <PageTitle>Audit Log</PageTitle>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Когда</th>
              <th className="px-4 py-3">Действие</th>
              <th className="px-4 py-3">Сущность</th>
              <th className="px-4 py-3">До → После</th>
              <th className="px-4 py-3">Причина</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-muted">{new Date(r.created_at).toLocaleString("ru-RU", { timeZone: ctx.club.timezone })}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                <td className="px-4 py-3 text-xs text-muted">{r.entity_type}<br />{r.entity_id?.slice(0, 8)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.before ? JSON.stringify(r.before) : "—"} → {r.after ? JSON.stringify(r.after) : "—"}
                </td>
                <td className="px-4 py-3">{r.reason ?? ""}</td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Пусто</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
