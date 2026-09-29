import type { Enums } from "@/lib/supabase/database.types";

export const REASON_LABEL: Record<Enums<"rating_tx_reason">, string> = {
  TOURNAMENT_MATCH: "Турнирный матч",
  CHALLENGE_MATCH: "Челлендж",
  CASUAL_MATCH: "Товарищеский матч",
  NEWCOMER_INITIAL: "Стартовый рейтинг",
  EXTERNAL_SEED: "Инициализация из RTTF",
  MANUAL_ADJUSTMENT: "Корректировка админом",
  REVERSAL: "Отмена транзакции",
};

type Row = {
  id: string;
  rating_before: number | null;
  rating_delta: number;
  rating_after: number;
  reason: Enums<"rating_tx_reason">;
  created_at: string;
};

const r = (v: number) => Math.floor(v + 0.5);

export function RatingHistory({ rows, timezone }: { rows: Row[]; timezone: string }) {
  if (rows.length === 0) {
    return <div className="card text-sm text-muted">Изменений рейтинга пока нет.</div>;
  }
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-5 py-3">Дата</th>
            <th className="px-5 py-3">Причина</th>
            <th className="px-5 py-3 text-right">До</th>
            <th className="px-5 py-3 text-right">Δ</th>
            <th className="px-5 py-3 text-right">После</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="px-5 py-3 text-muted">
                {new Date(t.created_at).toLocaleString("ru-RU", { timeZone: timezone, dateStyle: "short", timeStyle: "short" })}
              </td>
              <td className="px-5 py-3">{REASON_LABEL[t.reason]}</td>
              <td className="px-5 py-3 text-right tabular-nums text-muted">{t.rating_before === null ? "—" : r(t.rating_before)}</td>
              <td className={`px-5 py-3 text-right tabular-nums font-medium ${t.rating_delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {t.rating_delta >= 0 ? "+" : ""}{r(t.rating_delta)}
              </td>
              <td className="px-5 py-3 text-right tabular-nums font-semibold">{r(t.rating_after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
