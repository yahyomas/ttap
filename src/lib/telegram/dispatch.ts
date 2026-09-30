import "server-only";
import { InlineKeyboard } from "grammy";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBot, appUrl } from "./index";
import type { Enums } from "@/lib/supabase/database.types";

/**
 * Outbox dispatcher (spec §98): delivers notifications with telegram_sent_at IS NULL to linked
 * Telegram accounts, honouring users.notification_prefs. Idempotent: each row is marked sent
 * (or skipped) exactly once. Safe to call concurrently at low volume; cron + after() both call it.
 */

const PREF_BY_KIND: Record<Enums<"notification_kind">, "challenge" | "tournament" | "match" | "rating"> = {
  CHALLENGE_CREATED: "challenge", CHALLENGE_ACCEPTED: "challenge", CHALLENGE_DECLINED: "challenge",
  CHALLENGE_CANCELLED: "challenge", CHALLENGE_RESULT_SUBMITTED: "match", CHALLENGE_RESULT_REJECTED: "match",
  CHALLENGE_COMPLETED: "rating",
  TOURNAMENT_REGISTRATION_OPEN: "tournament", BRACKET_LOCKED: "tournament", TOURNAMENT_MATCH_CONFIRMED: "match",
  TOURNAMENT_COMPLETED: "tournament", RATING_CHANGED: "rating", PLAYER_APPROVED: "tournament", EXTERNAL_RATING_VERIFIED: "rating",
};

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

export async function dispatchNotifications(limit = 50): Promise<{ sent: number; skipped: number; failed: number }> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { sent: 0, skipped: 0, failed: 0 };
  const db = createAdminClient();
  const bot = getBot();
  const base = appUrl();

  const { data: rows, error } = await db
    .from("notifications")
    .select("id, user_id, kind, title, body, link, payload")
    .is("telegram_sent_at", null)
    .order("created_at")
    .limit(limit);
  if (error || !rows || rows.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: accounts }, { data: users }] = await Promise.all([
    db.from("telegram_accounts").select("user_id, chat_id").in("user_id", userIds),
    db.from("users").select("id, notification_prefs").in("id", userIds),
  ]);
  const chatBy = new Map((accounts ?? []).map((a) => [a.user_id, a.chat_id]));
  const prefsBy = new Map((users ?? []).map((u) => [u.id, (u.notification_prefs ?? {}) as Record<string, boolean>]));

  let sent = 0, skipped = 0, failed = 0;
  for (const n of rows) {
    const chat = chatBy.get(n.user_id);
    const prefs = prefsBy.get(n.user_id) ?? {};
    const enabled = prefs[PREF_BY_KIND[n.kind]] !== false;
    if (!chat || !enabled) {
      // nothing to deliver — mark as handled so the row is not retried forever
      await db.from("notifications").update({ telegram_sent_at: new Date().toISOString() }).eq("id", n.id);
      skipped++;
      continue;
    }
    try {
      const payload = (n.payload ?? {}) as Record<string, unknown>;
      const kb = new InlineKeyboard();
      if (n.kind === "CHALLENGE_CREATED" && typeof payload.challenge_id === "string") {
        kb.text("✅ Принять", `ch:acc:${payload.challenge_id}`).text("❌ Отклонить", `ch:dec:${payload.challenge_id}`).row();
      }
      if (n.kind === "TOURNAMENT_REGISTRATION_OPEN" && typeof payload.tournament_id === "string") {
        kb.text("📝 Зарегистрироваться", `tr:reg:${payload.tournament_id}`).row();
      }
      if (n.link) kb.url("Открыть", `${base}${n.link}`);
      const text = `<b>${esc(n.title)}</b>${n.body ? `\n${esc(n.body)}` : ""}`;
      await bot.api.sendMessage(chat, text, {
        parse_mode: "HTML",
        reply_markup: kb.inline_keyboard.length ? kb : undefined,
        link_preview_options: { is_disabled: true },
      });
      await db.from("notifications").update({ telegram_sent_at: new Date().toISOString() }).eq("id", n.id);
      sent++;
    } catch (e) {
      failed++;
      console.error("[telegram] send failed", n.id, e);
      // 403 = user blocked the bot → stop retrying that row
      const msg = e instanceof Error ? e.message : String(e);
      if (/403|blocked|chat not found/i.test(msg)) {
        await db.from("notifications").update({ telegram_sent_at: new Date().toISOString() }).eq("id", n.id);
      }
    }
  }
  return { sent, skipped, failed };
}
