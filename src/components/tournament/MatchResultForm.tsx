"use client";

import { useActionState, useState } from "react";
import { submitMatchResult, type ActionState } from "@/lib/actions/tournaments";

type P = { id: string; name: string };

export function MatchResultForm({
  matchId, tournamentId, player1, player2, mode,
}: { matchId: string; tournamentId: string; player1: P; player2: P; mode: "confirm" | "correct" }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitMatchResult, {});
  const [open, setOpen] = useState(mode === "confirm");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full text-xs text-muted hover:text-fg">
        Исправить результат
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2 text-xs">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <input type="hidden" name="mode" value={mode} />
      <div className="flex gap-1">
        <label className="flex flex-1 cursor-pointer items-center gap-1 rounded border border-border px-2 py-1 has-[:checked]:border-accent">
          <input type="radio" name="winner_player_id" value={player1.id} required /> <span className="truncate">{player1.name}</span>
        </label>
        <label className="flex flex-1 cursor-pointer items-center gap-1 rounded border border-border px-2 py-1 has-[:checked]:border-accent">
          <input type="radio" name="winner_player_id" value={player2.id} /> <span className="truncate">{player2.name}</span>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted">Счёт</span>
        <input name="winner_sets" type="number" min={1} max={7} defaultValue={3} className="input w-14 px-1 py-1 text-center" required />
        <span>:</span>
        <input name="loser_sets" type="number" min={0} max={6} defaultValue={0} className="input w-14 px-1 py-1 text-center" required />
        <span className="text-muted">(победитель : проигравший)</span>
      </div>
      {mode === "correct" && (
        <input name="reason" className="input px-2 py-1" placeholder="Причина исправления" required minLength={3} />
      )}
      {state.error && <div className="text-red-600">{state.error}</div>}
      <div className="flex gap-1">
        <button className="btn-primary flex-1 px-2 py-1 text-xs" disabled={pending}>
          {pending ? "…" : mode === "correct" ? "Исправить" : "Подтвердить"}
        </button>
        {mode === "correct" && (
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setOpen(false)}>Отмена</button>
        )}
      </div>
    </form>
  );
}
