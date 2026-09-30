import Link from "next/link";
import type { Enums } from "@/lib/supabase/database.types";
import { CHALLENGE_STATUS_CLASS, CHALLENGE_STATUS_LABEL, fmtDateTime } from "@/lib/queries/challenges";

export function ChallengeStatusBadge({ value }: { value: Enums<"challenge_status"> }) {
  return <span className={`badge ${CHALLENGE_STATUS_CLASS[value]}`}>{CHALLENGE_STATUS_LABEL[value]}</span>;
}

type P = { id: string; display_name: string; current_rating: number | null };

export function ChallengeCard({
  c, meId, tz, href,
}: {
  c: { id: string; status: Enums<"challenge_status">; proposed_at: string; message: string | null; challenger: P; opponent: P;
       match: { winner_player_id: string | null; winner_sets: number | null; loser_sets: number | null; rated: boolean | null } | null };
  meId?: string;
  tz: string;
  href: string;
}) {
  const other = c.challenger.id === meId ? c.opponent : c.challenger;
  const dir = c.challenger.id === meId ? "→" : "←";
  const r = (v: number | null) => (v === null ? "—" : Math.floor(v + 0.5));
  return (
    <Link href={href} className="card block hover:border-accent/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">
            {meId ? <>{dir} {other.display_name} <span className="text-sm font-normal text-muted">({r(other.current_rating)})</span></>
                  : <>{c.challenger.display_name} vs {c.opponent.display_name}</>}
          </div>
          <div className="mt-1 text-sm text-muted">{fmtDateTime(c.proposed_at, tz)}</div>
          {c.message && <div className="mt-1 text-sm">{c.message}</div>}
          {c.match && c.match.winner_player_id && (
            <div className="mt-1 text-sm">
              {c.match.winner_player_id === c.challenger.id ? c.challenger.display_name : c.opponent.display_name} выиграл{" "}
              <b>{c.match.winner_sets}:{c.match.loser_sets}</b>
              {c.match.rated === false && <span className="ml-1 text-xs text-muted">без рейтинга</span>}
            </div>
          )}
        </div>
        <ChallengeStatusBadge value={c.status} />
      </div>
    </Link>
  );
}
