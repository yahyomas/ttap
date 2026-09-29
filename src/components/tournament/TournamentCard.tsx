import Link from "next/link";
import type { Tables } from "@/lib/supabase/database.types";
import { TOURNAMENT_STATUS_CLASS, TOURNAMENT_STATUS_LABEL } from "@/lib/queries/tournaments";

export function fmtDate(iso: string, tz: string) {
  return new Date(iso).toLocaleString("ru-RU", { timeZone: tz, weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export function TournamentStatusBadge({ value }: { value: Tables<"tournaments">["status"] }) {
  return <span className={`badge ${TOURNAMENT_STATUS_CLASS[value]}`}>{TOURNAMENT_STATUS_LABEL[value]}</span>;
}

export function TournamentCard({
  t, tz, href, extra,
}: { t: Tables<"tournaments">; tz: string; href: string; extra?: React.ReactNode }) {
  return (
    <Link href={href} className="card block hover:border-accent/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{t.name}</div>
          <div className="mt-1 text-sm text-muted">{fmtDate(t.starts_at, tz)}</div>
          {t.registration_deadline && t.status === "REGISTRATION_OPEN" && (
            <div className="text-xs text-muted">Регистрация до {fmtDate(t.registration_deadline, tz)}</div>
          )}
        </div>
        <TournamentStatusBadge value={t.status} />
      </div>
      {extra && <div className="mt-3 text-sm">{extra}</div>}
    </Link>
  );
}
