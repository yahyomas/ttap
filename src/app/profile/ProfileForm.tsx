"use client";

import { useActionState } from "react";
import { updateProfile, type OnboardingState } from "@/lib/actions/onboarding";
import { ErrorBox } from "@/components/ui";
import type { Player } from "@/lib/session";

export function ProfileForm({ player }: { player: Player }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(updateProfile, {});
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="first_name">Имя</label>
          <input id="first_name" name="first_name" defaultValue={player.first_name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="last_name">Фамилия</label>
          <input id="last_name" name="last_name" defaultValue={player.last_name} required className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="display_name">Отображаемое имя</label>
        <input id="display_name" name="display_name" defaultValue={player.display_name} required minLength={2} className="input" />
      </div>
      <fieldset>
        <legend className="label">Игровая рука</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["RIGHT", "LEFT"] as const).map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-accent">
              <input type="radio" name="playing_hand" value={v} defaultChecked={player.playing_hand === v} />
              {v === "RIGHT" ? "Правая" : "Левая"}
            </label>
          ))}
        </div>
      </fieldset>
      <ErrorBox message={state.error} />
      <button className="btn-primary" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</button>
    </form>
  );
}
