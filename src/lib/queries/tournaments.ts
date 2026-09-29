import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/supabase/database.types";

type DB = SupabaseClient<Database>;

export const TOURNAMENT_STATUS_LABEL: Record<Enums<"tournament_status">, string> = {
  DRAFT: "Черновик",
  REGISTRATION_OPEN: "Регистрация открыта",
  REGISTRATION_CLOSED: "Регистрация закрыта",
  IN_PROGRESS: "Идёт",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

export const TOURNAMENT_STATUS_CLASS: Record<Enums<"tournament_status">, string> = {
  DRAFT: "bg-gray-500/15 text-gray-500",
  REGISTRATION_OPEN: "bg-emerald-500/15 text-emerald-600",
  REGISTRATION_CLOSED: "bg-amber-500/15 text-amber-600",
  IN_PROGRESS: "bg-blue-500/15 text-blue-600",
  COMPLETED: "bg-gray-500/15 text-gray-500",
  CANCELLED: "bg-red-500/15 text-red-600",
};

export async function loadTournamentDetail(db: DB, id: string, clubId: string) {
  const [{ data: t }, { data: parts }, { data: matches }] = await Promise.all([
    db.from("tournaments").select("*").eq("id", id).eq("club_id", clubId).is("deleted_at", null).maybeSingle(),
    db
      .from("tournament_participants")
      .select("id, player_id, status, seed, rating_at_lock, rating_status_at_lock, final_place, registered_at, players!inner(id, display_name, current_rating, rating_status, playing_hand)")
      .eq("tournament_id", id)
      .order("seed", { ascending: true, nullsFirst: false })
      .order("registered_at"),
    db
      .from("matches")
      .select("*")
      .eq("tournament_id", id)
      .is("deleted_at", null)
      .order("round")
      .order("position"),
  ]);
  if (!t) return null;

  const names = new Map<string, string>();
  for (const p of parts ?? []) names.set(p.player_id, p.players.display_name);

  const rounds = matches && matches.length > 0 ? Math.max(...matches.map((m) => m.round ?? 1)) : 0;

  return {
    tournament: t,
    participants: parts ?? [],
    registered: (parts ?? []).filter((p) => p.status === "REGISTERED"),
    matches: matches ?? [],
    rounds,
    names,
  };
}

export type TournamentDetail = NonNullable<Awaited<ReturnType<typeof loadTournamentDetail>>>;
