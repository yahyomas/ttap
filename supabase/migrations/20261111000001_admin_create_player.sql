-- Admin creates a player directly (spec §5.2 "администратор управляет игроками").
-- Player is ACTIVE immediately (creation by admin counts as approval). Optional auth user link.
-- Optional RTTF rating; if p_rttf_verified, it is verified right away and seeds Club Rating per club policy.
create or replace function public.admin_create_player(
  p_club_slug text,
  p_first_name text, p_last_name text, p_display_name text,
  p_birth_date date, p_gender public.gender, p_playing_hand public.playing_hand,
  p_user_id uuid default null,
  p_rttf_rating integer default null, p_rttf_verified boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_club uuid; v_player uuid; v_ext uuid;
begin
  select id into v_club from public.clubs where slug = p_club_slug;
  if v_club is null then raise exception 'club not found'; end if;
  if not public.is_club_admin(v_club) then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(trim(p_first_name)) = 0 or length(trim(p_last_name)) = 0 or length(trim(p_display_name)) < 2 then
    raise exception 'name fields required';
  end if;

  if p_user_id is not null then
    insert into public.users (id, email) select id, email from auth.users where id = p_user_id on conflict (id) do nothing;
    if exists (select 1 from public.players where club_id = v_club and user_id = p_user_id and deleted_at is null) then
      raise exception 'у этого аккаунта уже есть игрок в клубе' using errcode = '23505';
    end if;
    insert into public.club_memberships (club_id, user_id, role) values (v_club, p_user_id, 'PLAYER')
    on conflict (club_id, user_id) do nothing;
  end if;

  insert into public.players (club_id, user_id, first_name, last_name, display_name, birth_date, gender, playing_hand,
                              status, approved_at, approved_by)
  values (v_club, p_user_id, trim(p_first_name), trim(p_last_name), trim(p_display_name), p_birth_date, p_gender, p_playing_hand,
          'ACTIVE', now(), auth.uid())
  returning id into v_player;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_club, auth.uid(), 'PLAYER_CREATED_BY_ADMIN', 'player', v_player::text,
          jsonb_build_object('display_name', p_display_name, 'has_account', p_user_id is not null));

  if p_rttf_rating is not null then
    insert into public.player_external_ratings (club_id, player_id, source, rating)
    values (v_club, v_player, 'RTTF', p_rttf_rating) returning id into v_ext;
    if p_rttf_verified then
      perform public.admin_verify_external_rating(v_ext, 'VERIFIED');
    end if;
  end if;
  return v_player;
end $$;
grant execute on function public.admin_create_player(text, text, text, text, date, public.gender, public.playing_hand, uuid, integer, boolean) to authenticated;
