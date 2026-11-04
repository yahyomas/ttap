"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

function Pending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="ml-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px] opacity-70"
    />
  );
}

/**
 * Top-nav link with instant feedback: active-tab highlight by pathname and a spinner while the
 * navigation is in flight (server components are still rendering on Vercel).
 */
export function NavLink({ href, children, className = "", exact = false }: { href: string; children: React.ReactNode; className?: string; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact || href === "/" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 transition hover:bg-border/40 ${active ? "bg-border/60 font-medium" : ""} ${className}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
      <Pending />
    </Link>
  );
}
