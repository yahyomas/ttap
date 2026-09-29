-- Trigger functions: fixed search_path
alter function public.set_updated_at() set search_path = public;
alter function public.guard_player_self_update() set search_path = public;

-- Default: revoke public execute on every function in public, then re-grant explicitly.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Internal helpers (used inside RLS policies) — callable by authenticated only.
grant execute on function public.is_club_admin(uuid), public.is_club_member(uuid), public.current_club_ids()
  to authenticated;

-- Public RPCs for signed-in users
grant execute on function
  public.complete_onboarding(text, text, text, text, date, public.gender, public.playing_hand, integer),
  public.admin_approve_player(uuid),
  public.admin_set_player_blocked(uuid, boolean, text),
  public.admin_verify_external_rating(uuid, public.verification_status),
  public.admin_adjust_rating(uuid, numeric, text)
  to authenticated;
