import type { Enums } from "@/lib/supabase/database.types";

export function Rating({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  return <span className="tabular-nums">{Math.floor(value + 0.5)}</span>;
}

export function Hand({ value }: { value: Enums<"playing_hand"> }) {
  return <span>{value === "LEFT" ? "Левая" : "Правая"}</span>;
}

const STATUS_LABEL: Record<Enums<"rating_status">, string> = {
  NEW: "Новичок",
  PROVISIONAL: "Предварительный",
  ESTABLISHED: "Установившийся",
};
const STATUS_CLASS: Record<Enums<"rating_status">, string> = {
  NEW: "bg-gray-500/15 text-gray-500",
  PROVISIONAL: "bg-amber-500/15 text-amber-600",
  ESTABLISHED: "bg-emerald-500/15 text-emerald-600",
};

export function RatingStatusBadge({ value }: { value: Enums<"rating_status"> }) {
  return <span className={`badge ${STATUS_CLASS[value]}`}>{STATUS_LABEL[value]}</span>;
}

const PSTATUS_LABEL: Record<Enums<"player_status">, string> = {
  PENDING: "Ожидает одобрения",
  ACTIVE: "Активен",
  BLOCKED: "Заблокирован",
};
const PSTATUS_CLASS: Record<Enums<"player_status">, string> = {
  PENDING: "bg-amber-500/15 text-amber-600",
  ACTIVE: "bg-emerald-500/15 text-emerald-600",
  BLOCKED: "bg-red-500/15 text-red-600",
};

export function PlayerStatusBadge({ value }: { value: Enums<"player_status"> }) {
  return <span className={`badge ${PSTATUS_CLASS[value]}`}>{PSTATUS_LABEL[value]}</span>;
}

const VSTATUS_LABEL: Record<Enums<"verification_status">, string> = {
  PENDING: "Не подтверждён",
  VERIFIED: "Подтверждён",
  REJECTED: "Отклонён",
};
export function VerificationBadge({ value }: { value: Enums<"verification_status"> }) {
  const cls =
    value === "VERIFIED"
      ? "bg-emerald-500/15 text-emerald-600"
      : value === "REJECTED"
        ? "bg-red-500/15 text-red-600"
        : "bg-amber-500/15 text-amber-600";
  return <span className={`badge ${cls}`}>{VSTATUS_LABEL[value]}</span>;
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
      {message}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}
