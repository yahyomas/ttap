import "server-only";
import { createBot } from "./bot";
import { createAdminClient } from "@/lib/supabase/admin";

let cached: ReturnType<typeof createBot> | null = null;

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL?.replace(/^(?!https?:)/, "https://") ?? "http://localhost:3000").replace(/\/$/, "");
}

export function getBot() {
  if (cached) return cached;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  cached = createBot(token, { db: createAdminClient(), appUrl: appUrl() });
  return cached;
}

export function botUsername() {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
}
