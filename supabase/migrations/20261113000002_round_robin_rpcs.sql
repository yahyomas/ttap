-- Round robin support in lock / complete RPCs.
--  * admin_lock_bracket: next_match linking (winner advancement) only applies to SINGLE_ELIMINATION.
--    For ROUND_ROBIN `round` is the schedule round (circle method) and `position` the table index.
--  * admin_complete_tournament: optional p_places [{player_id, place}] computed by the app
--    (standings with tie-breaks for round robin). When null, falls back to final-match logic.

create or replace function public.admin_lock_bracket(p_tournament_id uuid, p_bracket jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t   public.tournaments%rowtype;
  v_s   jsonb;
  v_m   jsonb;
  v_registered integer;
  v_seeded integer;
  v_rounds integer;
begin
  select * into v_t from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found then raise exception 'tournament not found'; end if;
  if not public.is_club_admin(v_t.club_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_t.status not in ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED') then
    raise exception 'bracket can only be locked from registration state (current: %)', v_t.status;
  end if;

  select count(*) into v_registered from public.tournament_participants
    where tournament_id = p_tournament_id and status = 'REGISTERED';
  if v_registered < 2 then raise exception 'at least 2 participants required'; end if;
  v_seeded := jsonb_array_length(p_bracket -> 'seeds');
  if v_seeded <> v_registered then
    raise exception 'seeding covers % players but % are registered — refresh and retry', v_seeded, v_registered;
  end if;

  for v_s in select * from jsonb_array_elements(p_bracket -> 'seeds') loop
    update public.tournament_participants
      set seed = (v_s ->> 'seed')::int,
          rating_at_lock = (v_s ->> 'rating')::numeric,
          rating_status_at_lock = (v_s ->> 'rating_status')::public.rating_status
      where tournament_id = p_tournament_id and player_id = (v_s ->> 'player_id')::uuid and status = 'REGISTERED';
    if not found then raise exception 'seed refers to unknown participant %', v_s ->> 'player_id'; end if;
  end loop;

  for v_m in select * from jsonb_array_elements(p_bracket -> 'matches') loop
    insert into public.matches (club_id, match_type, tournament_id, round, position, player1_id, player2_id, created_by)
    values (v_t.club_id, 'TOURNAMENT', p_tournament_id,
            (v_m ->> 'round')::int, (v_m ->> 'position')::int,
            nullif(v_m ->> 'player1_id', '')::uuid, nullif(v_m ->> 'player2_id', '')::uuid, auth.uid());
  end loop;

  if v_t.format = 'SINGLE_ELIMINATION' then
    select max(round) into v_rounds from public.matches where tournament_id = p_tournament_id;
    update public.matches m
      set next_match_id = n.id,
          next_slot = case when m.position % 2 = 1 then 1 else 2 end
      from public.matches n
      where m.tournament_id = p_tournament_id and n.tournament_id = p_tournament_id
        and n.round = m.round + 1 and n.position = (m.position + 1) / 2
        and m.round < v_rounds;
  end if;

  update public.tournaments
    set status = 'IN_PROGRESS',
        bracket_size = (p_bracket ->> 'size')::int,
        average_rating = (p_bracket ->> 'average_rating')::numeric,
        k = (p_bracket ->> 'k')::numeric,
        seeding = p_bracket,
        locked_at = now()
    where id = p_tournament_id;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_t.club_id, auth.uid(), 'BRACKET_LOCKED', 'tournament', p_tournament_id::text,
          jsonb_build_object('format', v_t.format, 'size', p_bracket ->> 'size', 'participants', v_registered,
                             'average_rating', p_bracket ->> 'average_rating', 'k', p_bracket ->> 'k'));
end $$;

drop function if exists public.admin_complete_tournament(uuid, jsonb);
create function public.admin_complete_tournament(
  p_tournament_id uuid, p_newcomers jsonb default '[]'::jsonb, p_places jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_t       public.tournaments%rowtype;
  v_pending integer;
  v_final   public.matches%rowtype;
  v_n       jsonb;
  v_p       jsonb;
  v_player  public.players%rowtype;
  v_tp      record;
  v_count   integer;
  v_winner  uuid;
begin
  select * into v_t from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found then raise exception 'tournament not found'; end if;
  if not public.is_club_admin(v_t.club_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_t.status = 'COMPLETED' then return; end if;
  if v_t.status <> 'IN_PROGRESS' then raise exception 'tournament is %', v_t.status; end if;

  select count(*) into v_pending from public.matches
    where tournament_id = p_tournament_id and status = 'PENDING' and deleted_at is null;
  if v_pending > 0 then raise exception '% matches still pending', v_pending; end if;

  for v_n in select * from jsonb_array_elements(p_newcomers) loop
    select * into v_player from public.players where id = (v_n ->> 'player_id')::uuid for update;
    if not found then raise exception 'player not found'; end if;
    if v_player.current_rating is not null then
      raise exception 'player % already has a rating', v_player.display_name using errcode = '40001';
    end if;
    if not exists (select 1 from public.tournament_participants where tournament_id = p_tournament_id
                   and player_id = v_player.id and status = 'REGISTERED') then
      raise exception 'player % did not participate', v_player.display_name;
    end if;
    insert into public.rating_transactions
      (club_id, player_id, event_id, reason, tournament_id, rating_before, rating_delta, rating_after,
       rating_status_before, rating_status_after, calc, created_by)
    values
      (v_t.club_id, v_player.id, gen_random_uuid(), 'NEWCOMER_INITIAL', p_tournament_id,
       null, (v_n ->> 'rating')::numeric, (v_n ->> 'rating')::numeric,
       'NEW', 'PROVISIONAL', coalesce(v_n -> 'calc', '{}'::jsonb), auth.uid());
    update public.players
      set current_rating = (v_n ->> 'rating')::numeric, peak_rating = (v_n ->> 'rating')::numeric,
          rating_status = 'PROVISIONAL'
      where id = v_player.id;
  end loop;

  for v_tp in select tp.player_id from public.tournament_participants tp
              where tp.tournament_id = p_tournament_id and tp.status = 'REGISTERED'
  loop
    select * into v_player from public.players where id = v_tp.player_id for update;
    v_count := v_player.tournament_count + 1;
    update public.players
      set tournament_count = v_count,
          rating_status = case when current_rating is null then 'NEW'::public.rating_status
                               else public.tournament_status_after_count(v_count, v_t.club_id) end
      where id = v_player.id;
  end loop;

  if p_places is not null and jsonb_typeof(p_places) = 'array' and jsonb_array_length(p_places) > 0 then
    for v_p in select * from jsonb_array_elements(p_places) loop
      update public.tournament_participants set final_place = (v_p ->> 'place')::int
        where tournament_id = p_tournament_id and player_id = (v_p ->> 'player_id')::uuid and status = 'REGISTERED';
      if (v_p ->> 'place')::int = 1 then v_winner := (v_p ->> 'player_id')::uuid; end if;
    end loop;
  else
    select * into v_final from public.matches
      where tournament_id = p_tournament_id and deleted_at is null
      order by round desc, position asc limit 1;
    v_winner := v_final.winner_player_id;
    update public.tournament_participants set final_place = 1
      where tournament_id = p_tournament_id and player_id = v_final.winner_player_id;
    update public.tournament_participants set final_place = 2
      where tournament_id = p_tournament_id and player_id = v_final.loser_player_id;
  end if;

  update public.tournaments
    set status = 'COMPLETED', completed_at = now(), winner_player_id = v_winner
    where id = p_tournament_id;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_t.club_id, auth.uid(), 'TOURNAMENT_COMPLETED', 'tournament', p_tournament_id::text,
          jsonb_build_object('format', v_t.format, 'winner', v_winner, 'newcomers_rated', jsonb_array_length(p_newcomers),
                             'places', p_places));
end $$;
grant execute on function public.admin_complete_tournament(uuid, jsonb, jsonb) to authenticated;
