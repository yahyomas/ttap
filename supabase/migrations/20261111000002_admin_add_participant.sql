-- Admin adds a player to a tournament before the bracket is locked (spec §5.2, §21).
-- Unlike self-registration: allowed in DRAFT, ignores the registration deadline, but still respects
-- max_participants and requires an ACTIVE player of the same club.
create or replace function public.admin_add_participant(p_tournament_id uuid, p_player_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_t      public.tournaments%rowtype;
  v_player public.players%rowtype;
  v_id     uuid;
  v_count  integer;
begin
  select * into v_t from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found then raise exception 'tournament not found'; end if;
  if not public.is_club_admin(v_t.club_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_t.status not in ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED') then
    raise exception 'сетка уже сформирована — добавить игрока нельзя';
  end if;

  select * into v_player from public.players where id = p_player_id and club_id = v_t.club_id and deleted_at is null;
  if not found then raise exception 'игрок не найден'; end if;
  if v_player.status <> 'ACTIVE' then raise exception 'игрок не активен'; end if;

  if v_t.max_participants is not null then
    select count(*) into v_count from public.tournament_participants
      where tournament_id = p_tournament_id and status = 'REGISTERED';
    if v_count >= v_t.max_participants then raise exception 'турнир заполнен'; end if;
  end if;

  insert into public.tournament_participants (club_id, tournament_id, player_id)
  values (v_t.club_id, p_tournament_id, p_player_id)
  on conflict (tournament_id, player_id) do update
    set status = 'REGISTERED', withdrawn_at = null, registered_at = now()
    where public.tournament_participants.status = 'WITHDRAWN'
  returning id into v_id;
  if v_id is null then raise exception 'игрок уже зарегистрирован' using errcode = '23505'; end if;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_t.club_id, auth.uid(), 'PARTICIPANT_ADDED_BY_ADMIN', 'tournament_participant', v_id::text,
          jsonb_build_object('tournament_id', p_tournament_id, 'player_id', p_player_id));
  return v_id;
end $$;
grant execute on function public.admin_add_participant(uuid, uuid) to authenticated;
