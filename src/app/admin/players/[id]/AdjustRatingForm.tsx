"use client";

import { useActionState } from "react";
import { adjustRating, type AdminActionState } from "@/lib/actions/admin";
import { ErrorBox } from "@/components/ui";

export function AdjustRatingForm({ playerId, current }: { playerId: string; current: number | null }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(adjustRating, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="player_id" value={playerId} />
      <div>
        <label className="label" htmlFor="new_rating">Новый рейтинг</label>
        <input id="new_rating" name="new_rating" type="number" step="1" min={1} defaultValue={current ? Math.floor(current + 0.5) : ""} className="input w-32" required />
      </div>
      <div className="min-w-[260px] flex-1">
        <label className="label" htmlFor="reason">Причина (попадёт в audit log)</label>
        <input id="reason" name="reason" className="input" required minLength={3} placeholder="Например: стартовый рейтинг по решению тренера" />
      </div>
      <button className="btn-secondary" disabled={pending}>{pending ? "…" : "Применить"}</button>
      <div className="basis-full">
        <ErrorBox message={state.error} />
        {state.ok && <div className="text-sm text-emerald-600">Корректировка записана.</div>}
      </div>
    </form>
  );
}
