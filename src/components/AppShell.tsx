import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/lib/session";

const NAV = [
  { href: "/", label: "Главная" },
  { href: "/leaderboard", label: "Рейтинг" },
  { href: "/players", label: "Игроки" },
  { href: "/challenges", label: "Челленджи" },
  { href: "/tournaments", label: "Турниры" },
  { href: "/profile", label: "Профиль" },
];

export async function AppShell({ ctx, children }: { ctx: SessionContext; children: React.ReactNode }) {
  let unread = 0;
  if (ctx.userId) {
    const db = await createClient();
    const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).is("read_at", null);
    unread = count ?? 0;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4">
        <Link href="/" className="text-lg font-semibold">
          🏓 {ctx.club.name}
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 hover:bg-border/40">
              {n.label}
            </Link>
          ))}
          {ctx.userId && (
            <Link href="/notifications" className="relative rounded-lg px-3 py-1.5 hover:bg-border/40" aria-label="Уведомления">
              🔔
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-fg">{unread}</span>
              )}
            </Link>
          )}
          {ctx.isAdmin && (
            <Link href="/admin" className="rounded-lg px-3 py-1.5 font-medium text-accent hover:bg-border/40">
              Админка
            </Link>
          )}
          {ctx.userId && (
            <form action={signOut}>
              <button className="rounded-lg px-3 py-1.5 text-muted hover:bg-border/40">Выйти</button>
            </form>
          )}
        </nav>
      </header>
      <main className="flex-1 py-6">{children}</main>
      <footer className="py-4 text-xs text-muted">Ermak Tennis · клубная платформа</footer>
    </div>
  );
}
