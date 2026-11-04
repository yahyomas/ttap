import { NavLink } from "@/components/NavLink";
import { requireAdmin } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Игроки" },
  { href: "/admin/tournaments", label: "Турниры" },
  { href: "/admin/challenges", label: "Челленджи" },
  { href: "/admin/audit", label: "Audit Log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  return (
    <AppShell ctx={ctx}>
      <div className="mb-6 flex items-center gap-1 border-b border-border pb-3 text-sm">
        <span className="mr-2 font-semibold text-accent">Админка</span>
        {ADMIN_NAV.map((n) => (
          <NavLink key={n.href} href={n.href} exact={n.href === "/admin"}>{n.label}</NavLink>
        ))}
      </div>
      {children}
    </AppShell>
  );
}
