"use client";

import { useActionState } from "react";
import { signUp, type AuthState } from "@/lib/actions/auth";
import { ErrorBox } from "@/components/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Пароль (минимум 8 символов)</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <ErrorBox message={state.error} />
      {state.message && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          {state.message}
        </div>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Создаём…" : "Продолжить"}
      </button>
    </form>
  );
}
