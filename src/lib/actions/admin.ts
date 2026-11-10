"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";
import { queueDispatch } from "@/lib/telegram/queue";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_SLUG } from "@/lib/config";

export type AdminActionState = { error?: string; ok?: boolean };

export async function approvePlayer(playerId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_approve_player", { p_player_id: playerId });
  if (error) throw new Error(error.message);
  queueDispatch();
  revalidatePath("/admin");
  revalidatePath("/admin/players");
  revalidatePath(`/admin/players/${playerId}`);
}

export async function setPlayerBlocked(playerId: string, blocked: boolean, reason?: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_player_blocked", {
    p_player_id: playerId,
    p_blocked: blocked,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/players");
  revalidatePath(`/admin/players/${playerId}`);
}

export async function verifyExternalRating(ratingId: string, verdict: "VERIFIED" | "REJECTED", playerId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_verify_external_rating", {
    p_rating_id: ratingId,
    p_verdict: verdict,
  });
  if (error) throw new Error(error.message);
  queueDispatch();
  revalidatePath("/admin");
  revalidatePath("/admin/players");
  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/leaderboard");
}

const adjustSchema = z.object({
  player_id: z.string().uuid(),
  new_rating: z.coerce.number().positive("Рейтинг должен быть положительным").max(5000),
  reason: z.string().trim().min(3, "Укажите причину (минимум 3 символа)").max(500),
});

export async function adjustRating(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_rating", {
    p_player_id: parsed.data.player_id,
    p_new_rating: parsed.data.new_rating,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/players/${parsed.data.player_id}`);
  revalidatePath("/leaderboard");
  return { ok: true };
}

// ---------------- create player (admin) ----------------

const createPlayerSchema = z.object({
  first_name: z.string().trim().min(1, "Введите имя").max(50),
  last_name: z.string().trim().min(1, "Введите фамилию").max(50),
  display_name: z.string().trim().min(2, "Отображаемое имя минимум 2 символа").max(30),
  birth_date: z.string().optional().transform((v) => (v ? v : undefined)),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  playing_hand: z.enum(["RIGHT", "LEFT"], { message: "Укажите игровую руку" }),
  email: z.string().trim().optional().transform((v) => (v ? v.toLowerCase() : undefined)).pipe(z.string().email("Некорректный email").optional()),
  password: z.string().optional().transform((v) => (v ? v : undefined)),
  rttf_rating: z.string().trim().optional().transform((v) => (v ? Number(v) : undefined)).pipe(z.number().int().min(1).max(3000).optional()),
  rttf_verified: z.enum(["on"]).optional(),
});

export async function createPlayer(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = createPlayerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.email && (!d.password || d.password.length < 8)) return { error: "Для аккаунта нужен пароль минимум 8 символов" };
  if (!d.email && d.password) return { error: "Укажите email, чтобы создать аккаунт для входа" };

  let userId: string | undefined;
  if (d.email && d.password) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email: d.email, password: d.password, email_confirm: true });
    if (error) {
      return { error: /already|registered|exists/i.test(error.message) ? "Этот email уже зарегистрирован" : error.message };
    }
    userId = data.user?.id;
  }

  const supabase = await createClient();
  const { data: playerId, error } = await supabase.rpc("admin_create_player", {
    p_club_slug: CLUB_SLUG,
    p_first_name: d.first_name,
    p_last_name: d.last_name,
    p_display_name: d.display_name,
    p_birth_date: d.birth_date,
    p_gender: d.gender,
    p_playing_hand: d.playing_hand,
    p_user_id: userId,
    p_rttf_rating: d.rttf_rating,
    p_rttf_verified: d.rttf_verified === "on",
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/admin/players");
  revalidatePath("/players");
  revalidatePath("/leaderboard");
  redirect(`/admin/players/${playerId}`);
}
