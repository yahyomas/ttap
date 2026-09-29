"use client";

import { useActionState } from "react";
import { createTournament, type ActionState } from "@/lib/actions/tournaments";
import { ErrorBox } from "@/components/ui";

export function CreateTournamentForm({ defaultStart }: { defaultStart: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTournament, {});
  return (
    <form action={action} className="card space-y-4">
      <h2 className="font-semibold">Новый турнир</h2>
      <div>
        <label className="label" htmlFor="name">Название</label>
        <input id="name" name="name" defaultValue="Пятничный турнир" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="starts_at">Дата и время начала</label>
        <input id="starts_at" name="starts_at" type="datetime-local" defaultValue={defaultStart} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="registration_deadline">Дедлайн регистрации (необязательно)</label>
        <input id="registration_deadline" name="registration_deadline" type="datetime-local" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="max_participants">Лимит участников (необязательно)</label>
        <input id="max_participants" name="max_participants" type="number" min={2} max={128} className="input" placeholder="например, 32" />
      </div>
      <div>
        <label className="label" htmlFor="description">Описание</label>
        <textarea id="description" name="description" rows={2} className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="open_now" value="yes" defaultChecked /> Сразу открыть регистрацию
      </label>
      <ErrorBox message={state.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Создаём…" : "Создать"}</button>
    </form>
  );
}
