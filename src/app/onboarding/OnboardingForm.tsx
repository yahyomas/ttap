"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingState } from "@/lib/actions/onboarding";
import { ErrorBox } from "@/components/ui";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const [hasRttf, setHasRttf] = useState<"yes" | "no">("no");

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
        <input id="display_name" name="display_name" required minLength={2} className="input" placeholder="Как вас показывать в рейтинге" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="birth_date">Дата рождения</label>
          <input id="birth_date" name="birth_date" type="date" required className="input" />
        </div>
        <div>
          <label className="label">Пол</label>
          <div className="flex gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="gender" value="MALE" required /> Мужской</label>
            <label className="flex items-center gap-2"><input type="radio" name="gender" value="FEMALE" /> Женский</label>
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="label">Игровая рука</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["RIGHT", "LEFT"] as const).map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-accent">
              <input type="radio" name="playing_hand" value={v} required />
              {v === "RIGHT" ? "Правая" : "Левая"}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Есть ли у вас рейтинг RTTF?</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="has_rttf" value="no" checked={hasRttf === "no"} onChange={() => setHasRttf("no")} /> Нет
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="has_rttf" value="yes" checked={hasRttf === "yes"} onChange={() => setHasRttf("yes")} /> Да
          </label>
        </div>
        {hasRttf === "yes" && (
          <div className="mt-3">
            <label className="label" htmlFor="rttf_rating">Рейтинг RTTF</label>
            <input id="rttf_rating" name="rttf_rating" type="number" min={1} max={3000} className="input" placeholder="например, 480" />
            <p className="mt-1 text-xs text-muted">Будет отмечен как «не подтверждён» до проверки администратором.</p>
          </div>
        )}
      </fieldset>

      <ErrorBox message={state.error} />
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Сохраняем…" : "Отправить на одобрение"}
      </button>
    </form>
  );
}
