/**
 * Register the production webhook:  npm run tg:webhook -- https://your-domain.com
 * Uses TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local (or the environment).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

try {
  for (const line of readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const base = process.argv[2]?.replace(/\/$/, "");
if (!base) {
  console.error("usage: npm run tg:webhook -- https://your-domain.com");
  process.exit(1);
}
const token = process.env.TELEGRAM_BOT_TOKEN!;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url: `${base}/api/telegram/webhook`, secret_token: secret || undefined, allowed_updates: ["message", "callback_query"], drop_pending_updates: true }),
});
console.log(await res.json());
await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ commands: [
    { command: "rating", description: "Мой рейтинг и топ клуба" },
    { command: "profile", description: "Профиль и статистика" },
    { command: "challenges", description: "Вызовы" },
    { command: "tournaments", description: "Ближайшие турниры" },
    { command: "help", description: "Помощь" },
  ] }),
});
