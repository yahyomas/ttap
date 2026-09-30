"use client";

import { useActionState, useState } from "react";
import { createChallenge, type ActionState } from "@/lib/actions/challenges";
import { ErrorBox } from "@/components/ui";

type P = { id: string; name: string; rating: number | null; isNew: boolean };

export function NewChallengeForm({ players, defaultOpponent, defaultTime, meIsNew }: { players: P[]; defaultOpponent?: string; defaultTime: string; meIsNew: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createChallenge, {});
  const [opp, setOpp] = useState(defaultOpponent ?? "");
  const chosen = players.find((p) => p.id === opp);
  const unrated = meIsNew || chosen?.isNew;

  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="opponent_id">Соперник</label>
        <select id="opponent_id" name="opponent_id" value={opp} onChange={(e) => setOpp(e.target.value)} required className="input">
          <option value="">— выберите —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.rating !== null ? `(${Math.floor(p.rating + 0.5)})` : "(новичок)"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="proposed_at">Когда играем</label>
        <input id="proposed_at" name="proposed_at" type="datetime-local" defaultValue={defaultTime} required className="input" />
        <p className="mt-1 text-xs text-muted">Если соперник не ответит до этого времени, вызов истечёт.</p>
      </div>
      <div>
        <label className="label" htmlFor="message">Сообщение (необязательно)</label>
        <input id="message" name="message" maxLength={200} className="input" placeholder="Стол №2, до 5 сетов" />
      </div>
      {unrated && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          Один из игроков — новичок без рейтинга: матч будет сохранён, но не повлияет на рейтинг.
        </div>
      )}
      <ErrorBox message={state.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Отправляем…" : "Отправить вызов"}</button>
    </form>
  );
}
