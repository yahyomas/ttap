"use client";

import { useState, useTransition } from "react";
import { completeTournament, lockBracket } from "@/lib/actions/tournaments";

export function LockBracketButton({ tournamentId, count }: { tournamentId: string; count: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <button
        className="btn-primary"
        disabled={pending || count < 2}
        onClick={() =>
          start(async () => {
            const r = await lockBracket(tournamentId);
            setError(r.error);
          })
        }
      >
        {pending ? "Формируем…" : `Сформировать сетку (${count})`}
      </button>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

export function CompleteTournamentButton({ tournamentId, disabled, pending: pendingMatches }: { tournamentId: string; disabled: boolean; pending: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string }>({});
  return (
    <div>
      <button
        className="btn-primary"
        disabled={pending || disabled}
        title={disabled ? `Осталось матчей: ${pendingMatches}` : undefined}
        onClick={() =>
          start(async () => {
            const r = await completeTournament(tournamentId);
            setMsg(r);
          })
        }
      >
        {pending ? "Завершаем…" : "Завершить турнир"}
      </button>
      {msg.error && <div className="mt-1 max-w-xs text-xs text-red-600">{msg.error}</div>}
      {msg.message && <div className="mt-1 max-w-xs text-xs text-emerald-600">{msg.message}</div>}
    </div>
  );
}
