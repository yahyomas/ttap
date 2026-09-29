import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Игроки" },
  { href: "/admin/tournaments", label: "Турниры" },
  { href: "/admin/audit", label: "Audit Log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  return (
    <AppShell ctx={ctx}>
      <div className="mb-6 flex items-center gap-1 border-b border-border pb-3 text-sm">
        <span className="mr-2 font-semibold text-accent">Админка</span>
        {ADMIN_NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 hover:bg-border/40">
            {n.label}
          </Link>
        ))}
      </div>
      {children}
    </AppShell>
  );
}
