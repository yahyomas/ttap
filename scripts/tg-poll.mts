/**
 * Local development: run the bot with long polling (no public URL needed) and deliver the
 * notification outbox every 10 s.   npm run tg:poll
 * Do not run while a webhook is set (Telegram allows only one of the two).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

for (const line of readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { createBot } = await import("../src/lib/telegram/bot.ts");
const { createClient } = await import("@supabase/supabase-js");
const { InlineKeyboard } = await import("grammy");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const bot = createBot(process.env.TELEGRAM_BOT_TOKEN!, { db, appUrl });

await bot.api.deleteWebhook();
await bot.api.setMyCommands([
  { command: "rating", description: "Мой рейтинг и топ клуба" },
  { command: "profile", description: "Профиль и статистика" },
  { command: "challenges", description: "Вызовы" },
  { command: "tournaments", description: "Ближайшие турниры" },
  { command: "help", description: "Помощь" },
]);

// minimal outbox loop (same logic as src/lib/telegram/dispatch.ts, without next/server deps)
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
async function tick() {
  const { data: rows } = await db.from("notifications").select("id, user_id, kind, title, body, link, payload").is("telegram_sent_at", null).order("created_at").limit(50);
  if (!rows?.length) return;
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: acc } = await db.from("telegram_accounts").select("user_id, chat_id").in("user_id", ids);
  const chatBy = new Map((acc ?? []).map((a) => [a.user_id, a.chat_id]));
  for (const n of rows) {
    const chat = chatBy.get(n.user_id);
    if (chat) {
      const p = (n.payload ?? {}) as Record<string, unknown>;
      const kb = new InlineKeyboard();
      if (n.kind === "CHALLENGE_CREATED" && typeof p.challenge_id === "string") kb.text("✅ Принять", `ch:acc:${p.challenge_id}`).text("❌ Отклонить", `ch:dec:${p.challenge_id}`).row();
      if (n.kind === "TOURNAMENT_REGISTRATION_OPEN" && typeof p.tournament_id === "string") kb.text("📝 Зарегистрироваться", `tr:reg:${p.tournament_id}`).row();
      if (n.link) kb.url("Открыть", `${appUrl}${n.link}`);
      try {
        await bot.api.sendMessage(chat, `<b>${esc(n.title)}</b>${n.body ? `\n${esc(n.body)}` : ""}`, { parse_mode: "HTML", reply_markup: kb.inline_keyboard.length ? kb : undefined, link_preview_options: { is_disabled: true } });
        console.log("sent", n.id, n.kind);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("send failed", n.id, msg);
        if (!/400|403|blocked|chat not found/i.test(msg)) continue; // transient → retry later
      }
    }
    await db.from("notifications").update({ telegram_sent_at: new Date().toISOString() }).eq("id", n.id);
  }
}
setInterval(() => tick().catch(console.error), 10_000);
void tick();

console.log(`🤖 polling as @${(await bot.api.getMe()).username} — appUrl=${appUrl}`);
await bot.start();
