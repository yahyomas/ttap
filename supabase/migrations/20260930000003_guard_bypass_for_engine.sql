-- The self-update guard on players must not block trusted RPCs that run on behalf of a player
-- (e.g. confirm_challenge_result → _apply_match_rating). Use a transaction-local flag.

create or replace function public.guard_player_self_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('ttap.bypass_guard', true) = 'on' then
    return new;
  end if;
  if auth.uid() is not null and not public.is_club_admin(old.club_id) then
    if new.club_id is distinct from old.club_id
      or new.user_id is distinct from old.user_id
      or new.status is distinct from old.status
      or new.current_rating is distinct from old.current_rating
      or new.peak_rating is distinct from old.peak_rating
      or new.rating_status is distinct from old.rating_status
      or new.tournament_count is distinct from old.tournament_count
      or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by
      or new.blocked_at is distinct from old.blocked_at
      or new.blocked_reason is distinct from old.blocked_reason
      or new.deleted_at is distinct from old.deleted_at
    then
      raise exception 'players: protected column modified' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create or replace function public._apply_match_rating(
  p_match public.matches, p_event_id uuid, p_reason public.rating_tx_reason, p_deltas jsonb, p_version integer
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_d      jsonb;
  v_player public.players%rowtype;
begin
  perform set_config('ttap.bypass_guard', 'on', true);  -- transaction-local
  for v_d in select * from jsonb_array_elements(p_deltas) loop
    select * into v_player from public.players where id = (v_d ->> 'player_id')::uuid for update;
    if not found then raise exception 'player % not found', v_d ->> 'player_id'; end if;
    if v_player.current_rating is distinct from (v_d ->> 'rating_before')::numeric then
      raise exception 'stale calculation for player %: expected before=% got %',
        v_player.display_name, v_player.current_rating, v_d ->> 'rating_before' using errcode = '40001';
    end if;
    if abs(coalesce((v_d ->> 'rating_before')::numeric, 0) + (v_d ->> 'delta')::numeric - (v_d ->> 'rating_after')::numeric) > 0.01 then
      raise exception 'inconsistent delta for player %', v_player.display_name;
    end if;

    insert into public.rating_transactions
      (club_id, player_id, event_id, reason, match_id, tournament_id, rating_before, rating_delta, rating_after,
       rating_status_before, rating_status_after, calc, calculation_version, created_by)
    values
      (p_match.club_id, v_player.id, p_event_id, p_reason, p_match.id, p_match.tournament_id,
       (v_d ->> 'rating_before')::numeric, (v_d ->> 'delta')::numeric, (v_d ->> 'rating_after')::numeric,
       v_player.rating_status, coalesce((v_d ->> 'status_after')::public.rating_status, v_player.rating_status),
       coalesce(v_d -> 'calc', '{}'::jsonb), p_version, auth.uid());

    update public.players
      set current_rating = (v_d ->> 'rating_after')::numeric,
          peak_rating = greatest(coalesce(peak_rating, 0), (v_d ->> 'rating_after')::numeric),
          rating_status = coalesce((v_d ->> 'status_after')::public.rating_status, rating_status)
      where id = v_player.id;
  end loop;
  perform set_config('ttap.bypass_guard', 'off', true);
end $$;
