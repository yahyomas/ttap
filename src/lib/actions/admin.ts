"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";
import { queueDispatch } from "@/lib/telegram/queue";

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
