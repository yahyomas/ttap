"use client";

import { useActionState, useEffect, useState } from "react";
import { submitMatchResult, type ActionState } from "@/lib/actions/tournaments";

type P = { id: string; name: string };
const MAX_SETS = 7;

function ScoreRow({
  name, value, onChange, winner, disabled,
}: { name: string; value: number; onChange: (v: number) => void; winner: boolean; disabled: boolean }) {
  const btn = "flex h-8 w-8 items-center justify-center rounded-md border border-border text-base leading-none hover:bg-fg/5 disabled:opacity-30";
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${winner ? "bg-emerald-500/10" : ""}`}>
      <span className={`min-w-0 truncate text-sm ${winner ? "font-semibold" : ""}`}>
        {winner && <span className="mr-1 text-emerald-500">✓</span>}
        {name}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className={btn} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} aria-label="минус">−</button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_SETS}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Math.min(MAX_SETS, Number(e.target.value) || 0)))}
          className="h-8 w-12 rounded-md border border-border bg-card text-center text-lg font-semibold tabular-nums outline-none [appearance:textfield] focus:border-accent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button type="button" className={btn} disabled={disabled || value >= MAX_SETS} onClick={() => onChange(value + 1)} aria-label="плюс">+</button>
      </div>
    </div>
  );
}

export function MatchResultForm({
  matchId, tournamentId, player1, player2, mode,
}: { matchId: string; tournamentId: string; player1: P; player2: P; mode: "confirm" | "correct" }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitMatchResult, {});
  const [open, setOpen] = useState(mode === "confirm");
  const [s1, setS1] = useState(0);
  const [s2, setS2] = useState(0);
  useEffect(() => {
    if (state.ok && mode === "correct") setOpen(false);
  }, [state.ok, mode]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full py-1 text-xs text-muted hover:text-fg">
        Исправить результат
      </button>
    );
  }

  const winner = s1 > s2 ? player1 : s2 > s1 ? player2 : null;
  const winnerSets = Math.max(s1, s2);
  const loserSets = Math.min(s1, s2);
  const valid = !!winner && winnerSets >= 1;
  const presets: [number, number][] = [[3, 0], [3, 1], [3, 2]];

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <input type="hidden" name="mode" value={mode} />
      {winner && <input type="hidden" name="winner_player_id" value={winner.id} />}
      <input type="hidden" name="winner_sets" value={winnerSets} />
      <input type="hidden" name="loser_sets" value={loserSets} />

      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {mode === "correct" ? "Исправить счёт (по сетам)" : "Счёт по сетам"}
      </div>
      <ScoreRow name={player1.name} value={s1} onChange={setS1} winner={winner?.id === player1.id} disabled={pending} />
      <ScoreRow name={player2.name} value={s2} onChange={setS2} winner={winner?.id === player2.id} disabled={pending} />

      <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
        <span>быстро:</span>
        {presets.map(([w, l]) => (
          <span key={`${w}${l}`} className="inline-flex gap-1">
            <button type="button" className="rounded border border-border px-1.5 py-0.5 hover:border-accent" onClick={() => { setS1(w); setS2(l); }}>
              {w}:{l}
            </button>
            <button type="button" className="rounded border border-border px-1.5 py-0.5 hover:border-accent" onClick={() => { setS1(l); setS2(w); }}>
              {l}:{w}
            </button>
          </span>
        ))}
      </div>

      {mode === "correct" && (
        <input name="reason" className="input px-2 py-1.5 text-xs" placeholder="Причина исправления" required minLength={3} />
      )}
      {state.error && <div className="text-xs text-red-500">{state.error}</div>}
      {!valid && (s1 > 0 || s2 > 0) && <div className="text-xs text-muted">Счёт не может быть равным</div>}

      <div className="flex gap-1">
        <button className="btn-primary flex-1 px-2 py-1.5 text-xs" disabled={pending || !valid}>
          {pending ? "Сохраняем…" : valid ? `${mode === "correct" ? "Исправить" : "Подтвердить"}: ${winner!.name} ${winnerSets}:${loserSets}` : "Введите счёт"}
        </button>
        {mode === "correct" && (
          <button type="button" className="btn-secondary px-2 py-1.5 text-xs" onClick={() => setOpen(false)}>Отмена</button>
        )}
      </div>
    </form>
  );
}
