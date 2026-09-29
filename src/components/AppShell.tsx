import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import type { SessionContext } from "@/lib/session";

const NAV = [
  { href: "/", label: "Главная" },
  { href: "/leaderboard", label: "Рейтинг" },
  { href: "/players", label: "Игроки" },
  { href: "/profile", label: "Профиль" },
];

export function AppShell({ ctx, children }: { ctx: SessionContext; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4">
      <header className="flex items-center justify-between gap-4 border-b border-border py-4">
        <Link href="/" className="text-lg font-semibold">
          🏓 {ctx.club.name}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 hover:bg-border/40">
              {n.label}
            </Link>
          ))}
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
      <footer className="py-4 text-xs text-muted">TT Club Platform · MVP</footer>
    </div>
  );
}
