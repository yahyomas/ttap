"use client";

import { useState, useTransition } from "react";
import { setPlayerBlocked } from "@/lib/actions/admin";

export function BlockForm({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return <button type="button" className="btn-secondary text-red-600" onClick={() => setOpen(true)}>Заблокировать</button>;
  }
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <div className="flex-1">
        <label className="label">Причина блокировки</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <button
        type="button"
        className="btn-primary"
        disabled={pending || reason.trim().length < 3}
        onClick={() => start(() => setPlayerBlocked(playerId, true, reason.trim()))}
      >
        Подтвердить
      </button>
      <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Отмена</button>
    </div>
  );
}
