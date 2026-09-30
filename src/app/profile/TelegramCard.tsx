"use client";

import { useState, useTransition } from "react";
import { createTelegramLink, unlinkTelegram } from "@/lib/actions/telegram";

export function TelegramCard({ linked }: { linked: { username: string | null; first_name: string | null; linked_at: string } | null }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string>();
  const [error, setError] = useState<string>();

  if (linked) {
    return (
      <div className="card">
        <div className="mb-2 text-sm font-medium">Telegram</div>
        <div className="text-sm">
          ✅ Привязан{linked.username ? <>: <b>@{linked.username}</b></> : linked.first_name ? <>: {linked.first_name}</> : null}
        </div>
        <button className="mt-3 text-xs text-muted hover:text-red-600" disabled={pending} onClick={() => start(() => unlinkTelegram())}>
          Отвязать
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium">Telegram</div>
      <p className="text-sm text-muted">Получайте вызовы, результаты и новости турниров в Telegram и отвечайте одной кнопкой.</p>
      {link ? (
        <div className="mt-3 space-y-2">
          <a href={link} target="_blank" rel="noreferrer" className="btn-primary w-full">Открыть бота и привязать</a>
          <p className="text-xs text-muted">Ссылка действует 10 минут. После нажатия «Start» в боте обновите эту страницу.</p>
        </div>
      ) : (
        <button
          className="btn-secondary mt-3 w-full"
          disabled={pending}
          onClick={() => start(async () => { const r = await createTelegramLink(); setLink(r.link); setError(r.error); })}
        >
          {pending ? "…" : "Привязать Telegram"}
        </button>
      )}
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </div>
  );
}
