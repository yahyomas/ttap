import { webhookCallback } from "grammy";
import { getBot } from "@/lib/telegram";
import { dispatchNotifications } from "@/lib/telegram/dispatch";
import { after } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Telegram webhook. Register with:  npm run tg:webhook -- https://<domain>
 * Telegram must send X-Telegram-Bot-Api-Secret-Token = TELEGRAM_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const handler = webhookCallback(getBot(), "std/http", { timeoutMilliseconds: 25_000 });
  const res = await handler(req);
  // a bot action (accept challenge, register) may have queued notifications for others
  after(() => dispatchNotifications().catch(() => {}));
  return res;
}
