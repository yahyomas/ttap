"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember, getSessionContext } from "@/lib/session";
import { confirmChallengeResult, ChallengeError } from "@/lib/services/challenges";
import { queueDispatch } from "@/lib/telegram/queue";

export type ActionState = { error?: string; ok?: boolean };

function msg(e: unknown) {
  return e instanceof ChallengeError || e instanceof Error ? e.message : "Неизвестная ошибка";
}

function revalidate(id?: string) {
  queueDispatch();
  revalidatePath("/challenges");
  if (id) revalidatePath(`/challenges/${id}`);
  revalidatePath("/admin/challenges");
  revalidatePath("/");
  revalidatePath("/leaderboard");
}

function localToIso(local: string, timeZone: string): string {
  const [date, time] = local.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(utcGuess - (asIfUtc - utcGuess)).toISOString();
}

const createSchema = z.object({
  opponent_id: z.string().uuid("Выберите соперника"),
  proposed_at: z.string().min(1, "Укажите дату и время"),
  message: z.string().trim().max(200).optional(),
});

export async function createChallenge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireMember();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await createClient();
  const { data, error } = await db.rpc("create_challenge", {
    p_opponent_id: parsed.data.opponent_id,
    p_proposed_at: localToIso(parsed.data.proposed_at, ctx.club.timezone),
    p_message: parsed.data.message || undefined,
  });
  if (error) return { error: error.message };
  revalidate(data);
  redirect(`/challenges/${data}`);
}

export async function respondChallenge(id: string, accept: boolean) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.rpc("respond_challenge", { p_challenge_id: id, p_accept: accept });
  if (error) throw new Error(error.message);
  revalidate(id);
}

export async function cancelChallenge(id: string, reason?: string) {
  await getSessionContext();
  const db = await createClient();
  const { error } = await db.rpc("cancel_challenge", { p_challenge_id: id, p_reason: reason });
  if (error) throw new Error(error.message);
  revalidate(id);
}

const resultSchema = z.object({
  challenge_id: z.string().uuid(),
  winner_id: z.string().uuid("Выберите победителя"),
  winner_sets: z.coerce.number().int().min(1).max(7),
  loser_sets: z.coerce.number().int().min(0).max(6),
});

export async function submitChallengeResult(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember();
  const parsed = resultSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.winner_sets <= d.loser_sets) return { error: "У победителя должно быть больше сетов" };
  const db = await createClient();
  const { error } = await db.rpc("submit_challenge_result", {
    p_challenge_id: d.challenge_id, p_winner_id: d.winner_id, p_winner_sets: d.winner_sets, p_loser_sets: d.loser_sets,
  });
  if (error) return { error: error.message };
  revalidate(d.challenge_id);
  return { ok: true };
}

export async function rejectChallengeResult(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember();
  const id = String(formData.get("challenge_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 3) return { error: "Напишите, что не так с результатом" };
  const db = await createClient();
  const { error } = await db.rpc("reject_challenge_result", { p_challenge_id: id, p_note: note });
  if (error) return { error: error.message };
  revalidate(id);
  return { ok: true };
}

export async function confirmChallenge(id: string): Promise<ActionState> {
  await getSessionContext();
  const db = await createClient();
  try {
    await confirmChallengeResult(db, id);
  } catch (e) {
    return { error: msg(e) };
  }
  revalidate(id);
  return { ok: true };
}

export async function markNotificationsRead() {
  const db = await createClient();
  await db.rpc("mark_notifications_read", {});
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
