"use client";

import { useActionState, useState } from "react";
import { createPlayer, type AdminActionState } from "@/lib/actions/admin";
import { ErrorBox } from "@/components/ui";

export function NewPlayerForm() {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(createPlayer, {});
  const [withAccount, setWithAccount] = useState(false);
  const [withRttf, setWithRttf] = useState(false);

  return (
    <form action={action} className="card space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="first_name">Имя</label>
          <input id="first_name" name="first_name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="last_name">Фамилия</label>
          <input id="last_name" name="last_name" required className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="display_name">Отображаемое имя</label>
        <input id="display_name" name="display_name" required minLength={2} className="input" placeholder="Как показывать в рейтинге" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="birth_date">Дата рождения</label>
          <input id="birth_date" name="birth_date" type="date" className="input" />
        </div>
        <div>
          <label className="label">Пол</label>
          <div className="flex gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="gender" value="MALE" /> Мужской</label>
            <label className="flex items-center gap-2"><input type="radio" name="gender" value="FEMALE" /> Женский</label>
          </div>
        </div>
      </div>
      <fieldset>
        <legend className="label">Игровая рука</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["RIGHT", "LEFT"] as const).map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-accent">
              <input type="radio" name="playing_hand" value={v} required defaultChecked={v === "RIGHT"} />
              {v === "RIGHT" ? "Правая" : "Левая"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withRttf} onChange={(e) => setWithRttf(e.target.checked)} /> Есть рейтинг RTTF
        </label>
        {withRttf && (
          <div className="mt-3 space-y-2">
            <input name="rttf_rating" type="number" min={1} max={3000} className="input" placeholder="например, 480" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="rttf_verified" /> Подтвердить сразу (станет стартовым Club Rating)
            </label>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withAccount} onChange={(e) => setWithAccount(e.target.checked)} /> Создать аккаунт для входа
        </label>
        {withAccount && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="password">Пароль (≥ 8)</label>
              <input id="password" name="password" type="text" minLength={8} className="input" autoComplete="off" placeholder="сообщите игроку" />
            </div>
          </div>
        )}
      </div>

      <ErrorBox message={state.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Создаём…" : "Добавить игрока"}</button>
    </form>
  );
}
