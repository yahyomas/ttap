"use client";

import { useActionState, useState, useTransition } from "react";
import { cancelChallenge, confirmChallenge, rejectChallengeResult, submitChallengeResult, type ActionState } from "@/lib/actions/challenges";
import { ErrorBox } from "@/components/ui";

type P = { id: string; name: string };

export function ChallengeActions({
  mode, challengeId, challenger, opponent, canTimeoutConfirm = false, allowCancel = false, isAdmin = false,
}: {
  mode: "submit" | "confirm";
  challengeId: string;
  challenger: P;
  opponent: P;
  canTimeoutConfirm?: boolean;
  allowCancel?: boolean;
  isAdmin?: boolean;
}) {
  const [submitState, submitAction, submitting] = useActionState<ActionState, FormData>(submitChallengeResult, {});
  const [rejectState, rejectAction, rejecting] = useActionState<ActionState, FormData>(rejectChallengeResult, {});
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const [rejectOpen, setRejectOpen] = useState(false);

  if (mode === "confirm") {
    return (
      <div className="space-y-3">
        <p className="text-sm">{isAdmin ? "Подтвердить результат как администратор:" : "Соперник внёс результат. Всё верно?"}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => start(async () => { const r = await confirmChallenge(challengeId); setErr(r.error); })}>
            {pending ? "…" : "Подтвердить результат"}
          </button>
          {!isAdmin && !rejectOpen && <button className="btn-secondary" onClick={() => setRejectOpen(true)}>Не согласен</button>}
        </div>
        {rejectOpen && (
          <form action={rejectAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="challenge_id" value={challengeId} />
            <div className="min-w-[240px] flex-1">
              <label className="label">Что не так?</label>
              <input name="note" className="input" required minLength={3} placeholder="Счёт был 3:2, а не 3:1" />
            </div>
            <button className="btn-secondary" disabled={rejecting}>Отклонить</button>
            <ErrorBox message={rejectState.error} />
          </form>
        )}
        <ErrorBox message={err} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={submitAction} className="space-y-3">
        <input type="hidden" name="challenge_id" value={challengeId} />
        <div>
          <label className="label">Кто выиграл</label>
          <div className="flex gap-2">
            {[challenger, opponent].map((p) => (
              <label key={p.id} className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-accent">
                <input type="radio" name="winner_id" value={p.id} required /> {p.name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Счёт по сетам</span>
          <input name="winner_sets" type="number" min={1} max={7} defaultValue={3} className="input w-16 text-center" required />
          <span>:</span>
          <input name="loser_sets" type="number" min={0} max={6} defaultValue={1} className="input w-16 text-center" required />
          <span className="text-muted">(победитель : проигравший)</span>
        </div>
        <ErrorBox message={submitState.error} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={submitting}>{submitting ? "…" : "Внести результат"}</button>
          {canTimeoutConfirm && (
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => start(async () => { const r = await confirmChallenge(challengeId); setErr(r.error); })}>
              Подтвердить по истечении срока
            </button>
          )}
          {allowCancel && (
            <button type="button" className="text-xs text-muted hover:text-red-600" disabled={pending} onClick={() => start(async () => { await cancelChallenge(challengeId); })}>
              Отменить матч
            </button>
          )}
        </div>
        <ErrorBox message={err} />
      </form>
    </div>
  );
}
