import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CLUB_SLUG } from "@/lib/config";
import type { Tables } from "@/lib/supabase/database.types";

export type Club = Tables<"clubs">;
export type Player = Tables<"players">;
export type Membership = Tables<"club_memberships">;

export type SessionContext = {
  userId: string | null;
  email: string | null;
  club: Club;
  membership: Membership | null;
  player: Player | null;
  isAdmin: boolean;
};

/** Loads user + club + membership + player once per request. */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();

  const { data: club, error: clubErr } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", CLUB_SLUG)
    .single();
  if (clubErr || !club) throw new Error(`Club '${CLUB_SLUG}' not found. Run migrations/seed.`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, email: null, club, membership: null, player: null, isAdmin: false };
  }

  const [{ data: membership }, { data: player }] = await Promise.all([
    supabase
      .from("club_memberships")
      .select("*")
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("players")
      .select("*")
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  return {
    userId: user.id,
    email: user.email ?? null,
    club,
    membership: membership ?? null,
    player: player ?? null,
    isAdmin: membership?.role === "ADMIN",
  };
});

/**
 * Gate for member-only pages. Redirects:
 *  - no user → /login
 *  - no player (and not admin) → /onboarding
 *  - PENDING → /pending, BLOCKED → /blocked
 */
export async function requireMember(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx.userId) redirect("/login");
  if (!ctx.player) {
    if (ctx.isAdmin) return ctx;
    redirect("/onboarding");
  }
  if (ctx.player.status === "PENDING" && !ctx.isAdmin) redirect("/pending");
  if (ctx.player.status === "BLOCKED" && !ctx.isAdmin) redirect("/blocked");
  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx.userId) redirect("/login");
  if (!ctx.isAdmin) redirect("/");
  return ctx;
}
