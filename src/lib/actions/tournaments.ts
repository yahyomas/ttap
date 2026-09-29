"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireMember } from "@/lib/session";
import {
  completeTournament as completeTournamentService,
  confirmTournamentMatch,
  correctTournamentMatch,
  lockBracket as lockBracketService,
  TournamentError,
} from "@/lib/services/tournaments";

export type ActionState = { error?: string; ok?: boolean; message?: string };

function msg(e: unknown): string {
  if (e instanceof TournamentError) return e.message;
  if (e instanceof Error) return e.message;
  return "Неизвестная ошибка";
}

function revalidateTournament(id: string) {
  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${id}`);
  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${id}`);
  revalidatePath("/leaderboard");
  revalidatePath("/");
}

// ---------------- player ----------------
export async function registerForTournament(tournamentId: string) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.rpc("register_for_tournament", { p_tournament_id: tournamentId });
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidateTournament(tournamentId);
}

export async function withdrawFromTournament(tournamentId: string) {
  await requireMember();
  const db = await createClient();
  const { error } = await db.rpc("withdraw_from_tournament", { p_tournament_id: tournamentId });
  if (error) throw new Error(error.message);
  revalidateTournament(tournamentId);
}

// ---------------- admin ----------------
const createSchema = z.object({
  name: z.string().trim().min(2, "Название минимум 2 символа").max(80),
  starts_at: z.string().min(1, "Укажите дату и время"),
  registration_deadline: z.string().optional(),
  max_participants: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(2).max(128).optional()),
  description: z.string().trim().max(500).optional(),
  open_now: z.enum(["yes", "no"]).default("yes"),
});

/** datetime-local (no tz) → ISO in club timezone. */
function localToIso(local: string, timeZone: string): string {
  // Interpret "YYYY-MM-DDTHH:mm" as wall time in the club's timezone.
  const [date, time] = local.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const offset = asIfUtc - utcGuess;
  return new Date(utcGuess - offset).toISOString();
}

export async function createTournament(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const db = await createClient();
  const { data, error } = await db
    .from("tournaments")
    .insert({
      club_id: ctx.club.id,
      name: d.name,
      description: d.description || null,
      starts_at: localToIso(d.starts_at, ctx.club.timezone),
      registration_deadline: d.registration_deadline ? localToIso(d.registration_deadline, ctx.club.timezone) : null,
      max_participants: d.max_participants ?? null,
      status: d.open_now === "yes" ? "REGISTRATION_OPEN" : "DRAFT",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await db.from("audit_logs").insert({
    club_id: ctx.club.id, actor_id: ctx.userId, action: "TOURNAMENT_CREATED",
    entity_type: "tournament", entity_id: data.id, after: { name: d.name, starts_at: d.starts_at },
  });
  revalidatePath("/tournaments");
  revalidatePath("/admin/tournaments");
  redirect(`/admin/tournaments/${data.id}`);
}

export async function setTournamentStatus(
  tournamentId: string,
  status: "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "CANCELLED",
) {
  await requireAdmin();
  const db = await createClient();
  const { error } = await db.rpc("admin_set_tournament_status", { p_tournament_id: tournamentId, p_status: status });
  if (error) throw new Error(error.message);
  revalidateTournament(tournamentId);
}

export async function removeParticipant(participantId: string, tournamentId: string) {
  await requireAdmin();
  const db = await createClient();
  const { error } = await db.rpc("admin_remove_participant", { p_participant_id: participantId });
  if (error) throw new Error(error.message);
  revalidateTournament(tournamentId);
}

export async function lockBracket(tournamentId: string): Promise<ActionState> {
  await requireAdmin();
  const db = await createClient();
  try {
    await lockBracketService(db, tournamentId);
  } catch (e) {
    return { error: msg(e) };
  }
  revalidateTournament(tournamentId);
  return { ok: true };
}

const resultSchema = z.object({
  match_id: z.string().uuid(),
  tournament_id: z.string().uuid(),
  winner_player_id: z.string().uuid("Выберите победителя"),
  winner_sets: z.coerce.number().int().min(1).max(7),
  loser_sets: z.coerce.number().int().min(0).max(6),
  reason: z.string().trim().optional(),
  mode: z.enum(["confirm", "correct"]).default("confirm"),
});

export async function submitMatchResult(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = resultSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.winner_sets <= d.loser_sets) return { error: "У победителя должно быть больше сетов" };

  const db = await createClient();
  try {
    if (d.mode === "correct") {
      if (!d.reason || d.reason.length < 3) return { error: "Укажите причину исправления" };
      await correctTournamentMatch(db, {
        matchId: d.match_id, winnerPlayerId: d.winner_player_id,
        winnerSets: d.winner_sets, loserSets: d.loser_sets, reason: d.reason,
      });
    } else {
      await confirmTournamentMatch(db, {
        matchId: d.match_id, winnerPlayerId: d.winner_player_id,
        winnerSets: d.winner_sets, loserSets: d.loser_sets,
      });
    }
  } catch (e) {
    return { error: msg(e) };
  }
  revalidateTournament(d.tournament_id);
  return { ok: true };
}

export async function completeTournament(tournamentId: string): Promise<ActionState> {
  await requireAdmin();
  const db = await createClient();
  try {
    const r = await completeTournamentService(db, tournamentId);
    revalidateTournament(tournamentId);
    return {
      ok: true,
      message:
        r.unresolved.length > 0
          ? `Турнир завершён. ${r.unresolved.length} новичк(ов) не играли с рейтинговыми соперниками — назначьте рейтинг вручную.`
          : `Турнир завершён. Стартовый рейтинг получили: ${r.rated}.`,
    };
  } catch (e) {
    return { error: msg(e) };
  }
}
