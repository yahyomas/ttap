"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CLUB_SLUG } from "@/lib/config";

const schema = z.object({
  first_name: z.string().trim().min(1, "Введите имя").max(50),
  last_name: z.string().trim().min(1, "Введите фамилию").max(50),
  display_name: z.string().trim().min(2, "Отображаемое имя минимум 2 символа").max(30),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату рождения"),
  gender: z.enum(["MALE", "FEMALE"], { message: "Укажите пол" }),
  playing_hand: z.enum(["RIGHT", "LEFT"], { message: "Укажите игровую руку" }),
  has_rttf: z.enum(["yes", "no"]).default("no"),
  rttf_rating: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(3000).optional()),
});

export type OnboardingState = { error?: string };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.has_rttf === "yes" && !d.rttf_rating) {
    return { error: "Укажите ваш рейтинг RTTF или выберите «Нет»" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_club_slug: CLUB_SLUG,
    p_first_name: d.first_name,
    p_last_name: d.last_name,
    p_display_name: d.display_name,
    p_birth_date: d.birth_date,
    p_gender: d.gender,
    p_playing_hand: d.playing_hand,
    p_rttf_rating: d.has_rttf === "yes" ? d.rttf_rating : undefined,
  });

  if (error) {
    if (error.code === "23505") redirect("/pending");
    return { error: `Не удалось сохранить профиль: ${error.message}` };
  }
  redirect("/pending");
}

const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(50),
  last_name: z.string().trim().min(1).max(50),
  display_name: z.string().trim().min(2).max(30),
  playing_hand: z.enum(["RIGHT", "LEFT"]),
});

export async function updateProfile(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("players").update(parsed.data).eq("user_id", user.id);
  if (error) return { error: error.message };
  redirect("/profile");
}
