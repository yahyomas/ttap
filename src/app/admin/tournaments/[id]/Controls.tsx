"use client";

import { useState, useTransition } from "react";
import { addParticipant, completeTournament, lockBracket } from "@/lib/actions/tournaments";

export function AddParticipantForm({
  tournamentId,
  players,
}: {
  tournamentId: string;
  players: { id: string; display_name: string; current_rating: number | null }[];
}) {
  const [pending, start] = useTransition();
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState<string>();
  if (players.length === 0) return <div className="text-sm text-muted">Все активные игроки уже в турнире.</div>;
  return (
    <div className="flex flex-wrap items-start gap-2">
      <select className="input max-w-xs" value={playerId} onChange={(e) => setPlayerId(e.target.value)} disabled={pending}>
        <option value="">— выберите игрока —</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}{p.current_rating !== null ? ` · ${Math.floor(p.current_rating + 0.5)}` : " · новичок"}
          </option>
        ))}
      </select>
      <button
        className="btn-primary"
        disabled={pending || !playerId}
        onClick={() =>
          start(async () => {
            const r = await addParticipant(tournamentId, playerId);
            setError(r.error);
            if (r.ok) setPlayerId("");
          })
        }
      >
        {pending ? "Добавляем…" : "Добавить в турнир"}
      </button>
      {error && <div className="w-full text-xs text-red-600">{error}</div>}
    </div>
  );
}

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
