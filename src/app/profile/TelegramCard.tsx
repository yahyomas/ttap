"use client";

import { useActionState, useState, useTransition } from "react";
import { claimTelegramCode, createTelegramLink, unlinkTelegram, type CodeState } from "@/lib/actions/telegram";
import { ErrorBox } from "@/components/ui";

export function TelegramCard({
  linked, botUsername,
}: { linked: { username: string | null; first_name: string | null; linked_at: string } | null; botUsername: string }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string>();
  const [error, setError] = useState<string>();
  const [codeState, codeAction, codePending] = useActionState<CodeState, FormData>(claimTelegramCode, {});

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
    <div className="card space-y-4">
      <div>
        <div className="mb-1 text-sm font-medium">Telegram</div>
        <p className="text-sm text-muted">Получайте вызовы, результаты и новости турниров в Telegram и отвечайте одной кнопкой.</p>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium uppercase text-muted">Способ 1 — код из бота</div>
        <p className="mb-2 text-sm">
          Напишите боту{" "}
          <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="text-accent underline">@{botUsername}</a>{" "}
          любое сообщение — он пришлёт 6-значный код. Введите его здесь:
        </p>
        <form action={codeAction} className="flex gap-2">
          <input name="code" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} placeholder="123456" className="input w-32 text-center tracking-widest" required />
          <button className="btn-primary" disabled={codePending}>{codePending ? "…" : "Привязать"}</button>
        </form>
        <div className="mt-2"><ErrorBox message={codeState.error} /></div>
        {codeState.ok && <div className="mt-2 text-sm text-emerald-600">Готово! Обновите страницу.</div>}
      </div>

      <div className="border-t border-border pt-3">
        <div className="mb-1 text-xs font-medium uppercase text-muted">Способ 2 — по ссылке</div>
        {link ? (
          <div className="space-y-2">
            <a href={link} target="_blank" rel="noreferrer" className="btn-primary w-full">Открыть бота и привязать</a>
            <p className="text-xs text-muted">Ссылка действует 10 минут. После нажатия «Start» в боте обновите эту страницу.</p>
          </div>
        ) : (
          <button
            className="btn-secondary w-full"
            disabled={pending}
            onClick={() => start(async () => { const r = await createTelegramLink(); setLink(r.link); setError(r.error); })}
          >
            {pending ? "…" : "Получить ссылку для привязки"}
          </button>
        )}
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>
    </div>
  );
}
