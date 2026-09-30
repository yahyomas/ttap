"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/session";
import { botUsername } from "@/lib/telegram";
import { queueDispatch } from "@/lib/telegram/queue";

export type LinkState = { link?: string; error?: string };

/** Generates a one-time deep link: t.me/<bot>?start=<token> (valid 10 minutes). */
export async function createTelegramLink(): Promise<LinkState> {
  await requireMember();
  const db = await createClient();
  const { data, error } = await db.rpc("create_telegram_link_token");
  if (error) return { error: error.message };
  const bot = botUsername();
  if (!bot) return { error: "Бот не настроен (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME)" };
  return { link: `https://t.me/${bot}?start=${data}` };
}

export async function unlinkTelegram() {
  await requireMember();
  const db = await createClient();
  await db.rpc("unlink_telegram");
  revalidatePath("/profile");
}

export async function updateNotificationPrefs(formData: FormData) {
  const ctx = await requireMember();
  const prefs = {
    challenge: formData.get("challenge") === "on",
    tournament: formData.get("tournament") === "on",
    match: formData.get("match") === "on",
    rating: formData.get("rating") === "on",
  };
  const db = await createClient();
  await db.from("users").update({ notification_prefs: prefs }).eq("id", ctx.userId!);
  revalidatePath("/profile");
}

export type CodeState = { error?: string; ok?: boolean };

/** Links the account using the 6-digit code the bot showed (reverse flow). */
export async function claimTelegramCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  await requireMember();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Код — 6 цифр" };
  const db = await createClient();
  const { data, error } = await db.rpc("claim_telegram_code", { p_code: code });
  if (error) return { error: error.message };
  const r = data as { ok: boolean; error?: string };
  if (!r.ok) return { error: "Код не подходит или устарел. Напишите боту ещё раз — он выдаст новый." };
  queueDispatch();
  revalidatePath("/profile");
  return { ok: true };
}
