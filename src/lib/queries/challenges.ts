import type { Enums } from "@/lib/supabase/database.types";

export const CHALLENGE_STATUS_LABEL: Record<Enums<"challenge_status">, string> = {
  PENDING: "Ожидает ответа",
  ACCEPTED: "Принят",
  DECLINED: "Отклонён",
  CANCELLED: "Отменён",
  EXPIRED: "Истёк",
  RESULT_SUBMITTED: "Результат на подтверждении",
  COMPLETED: "Сыгран",
};

export const CHALLENGE_STATUS_CLASS: Record<Enums<"challenge_status">, string> = {
  PENDING: "bg-amber-500/15 text-amber-600",
  ACCEPTED: "bg-blue-500/15 text-blue-600",
  DECLINED: "bg-gray-500/15 text-gray-500",
  CANCELLED: "bg-gray-500/15 text-gray-500",
  EXPIRED: "bg-gray-500/15 text-gray-500",
  RESULT_SUBMITTED: "bg-purple-500/15 text-purple-600",
  COMPLETED: "bg-emerald-500/15 text-emerald-600",
};

export const CHALLENGE_SELECT =
  "*, challenger:players!challenges_challenger_id_fkey(id, display_name, current_rating, rating_status), opponent:players!challenges_opponent_id_fkey(id, display_name, current_rating, rating_status), match:matches!challenges_match_id_fkey(id, status, winner_player_id, loser_player_id, winner_sets, loser_sets, rated, calc)";

export function fmtDateTime(iso: string, tz: string) {
  return new Date(iso).toLocaleString("ru-RU", { timeZone: tz, weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
