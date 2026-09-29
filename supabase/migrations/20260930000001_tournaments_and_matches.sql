-- Phase 3: tournaments (single elimination) + matches (spec §18–§24, §33, §61, §65, §72, §87)
--
-- Design decisions (see README):
--  * Tournament deltas are computed from ratings SNAPSHOTTED at bracket lock (rating_at_lock),
--    so the result does not depend on the order results are entered (spec §42 determinism).
--  * A match involving a NEW player (no rating) is stored but unrated for both sides.
--    NEW players receive their initial rating at tournament completion (NEWCOMER_INITIAL).
--  * The rating formula lives in TypeScript (src/domain/rating). RPCs receive the calculated
--    deltas, re-validate them against current projections, and apply everything atomically.

create type public.tournament_status as enum (
  'DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);
create type public.tournament_format as enum ('SINGLE_ELIMINATION');
create type public.participant_status as enum ('REGISTERED', 'WITHDRAWN', 'NO_SHOW');
create type public.match_type as enum ('TOURNAMENT', 'CHALLENGE', 'CASUAL');
create type public.match_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED', 'CORRECTED');

-- ---------- tournaments ----------
create table public.tournaments (
  id                     uuid primary key default gen_random_uuid(),
  club_id                uuid not null references public.clubs(id) on delete cascade,
  name                   text not null,
  description            text,
  format                 public.tournament_format not null default 'SINGLE_ELIMINATION',
  status                 public.tournament_status not null default 'DRAFT',
  starts_at              timestamptz not null,
  registration_deadline  timestamptz,
  max_participants       integer check (max_participants is null or max_participants between 2 and 128),
  -- filled at bracket lock (spec §23 snapshot)
  bracket_size           integer,
  average_rating         numeric(8,2),
  k                      numeric(6,3),
  seeding                jsonb,
  locked_at              timestamptz,
  -- filled at completion
  winner_player_id       uuid references public.players(id),
  completed_at           timestamptz,
  created_by             uuid references public.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);
create index tournaments_club_starts_idx on public.tournaments(club_id, starts_at desc) where deleted_at is null;
create trigger tournaments_updated_at before update on public.tournaments
  for each row execute function public.set_updated_at();

-- ---------- participants ----------
create table public.tournament_participants (
  id                     uuid primary key default gen_random_uuid(),
  club_id                uuid not null references public.clubs(id) on delete cascade,
  tournament_id          uuid not null references public.tournaments(id) on delete cascade,
  player_id              uuid not null references public.players(id) on delete cascade,
  status                 public.participant_status not null default 'REGISTERED',
  seed                   integer,
  rating_at_lock         numeric(8,2),
  rating_status_at_lock  public.rating_status,
  final_place            integer,
  registered_at          timestamptz not null default now(),
  withdrawn_at           timestamptz,
  unique (tournament_id, player_id)   -- spec §65 duplicate registration
);
create index tp_player_idx on public.tournament_participants(player_id);

-- ---------- matches ----------
create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  match_type       public.match_type not null,
  status           public.match_status not null default 'PENDING',
  tournament_id    uuid references public.tournaments(id) on delete cascade,
  challenge_id     uuid,                          -- FK added in challenges migration
  round            integer,                       -- 1 = first round
  position         integer,                       -- 1-based within round
  player1_id       uuid references public.players(id),
  player2_id       uuid references public.players(id),
  winner_player_id uuid references public.players(id),
  loser_player_id  uuid references public.players(id),
  winner_sets      integer,
  loser_sets       integer,
  rated            boolean,                       -- null until confirmed
  event_id         uuid not null default gen_random_uuid(),  -- rating idempotency key
  calc             jsonb,                         -- engine output (spec §60)
  next_match_id    uuid references public.matches(id),
  next_slot        smallint check (next_slot in (1, 2)),
  played_at        timestamptz,
  created_by       uuid references public.users(id),
  confirmed_by     uuid references public.users(id),
  confirmed_at     timestamptz,
  corrected_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  check (player1_id is null or player2_id is null or player1_id <> player2_id),
  check (status <> 'CONFIRMED' or (winner_sets > loser_sets and winner_player_id is not null and loser_player_id is not null)),
  unique (event_id)
);
create unique index matches_tournament_slot_idx on public.matches(tournament_id, round, position) where tournament_id is not null;
create index matches_club_played_idx on public.matches(club_id, played_at desc);
create index matches_player1_idx on public.matches(player1_id);
create index matches_player2_idx on public.matches(player2_id);
create trigger matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

alter table public.rating_transactions
  add constraint rating_transactions_match_fkey foreign key (match_id) references public.matches(id),
  add constraint rating_transactions_tournament_fkey foreign key (tournament_id) references public.tournaments(id);

-- ---------- RLS ----------
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.matches enable row level security;

create policy tournaments_select on public.tournaments for select
  using (deleted_at is null and status <> 'DRAFT' and public.is_club_member(club_id) or public.is_club_admin(club_id));
create policy tournaments_admin_all on public.tournaments for all
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

create policy tp_select on public.tournament_participants for select
  using (public.is_club_member(club_id));
create policy tp_admin_all on public.tournament_participants for all
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

create policy matches_select on public.matches for select
  using (deleted_at is null and public.is_club_member(club_id));
-- writes only through RPCs

grant select, insert, update on public.tournaments, public.tournament_participants to authenticated;
grant select on public.matches to authenticated;

-- ---------- helpers ----------
create or replace function public.tournament_status_after_count(p_count integer, p_club_id uuid)
returns public.rating_status language sql stable set search_path = public as $$
  select case
    when p_count <= 0 then 'NEW'::public.rating_status
    when p_count <= coalesce((select (settings #>> '{rating,newcomer_tournaments}')::int from public.clubs where id = p_club_id), 5)
      then 'PROVISIONAL'::public.rating_status
    else 'ESTABLISHED'::public.rating_status
  end;
$$;

-- ---------- RPC: player registration (spec §21.2, §65) ----------
create or replace function public.register_for_tournament(p_tournament_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_t      public.tournaments%rowtype;
  v_player public.players%rowtype;
  v_id     uuid;
  v_count  integer;
begin
  select * into v_t from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found then raise exception 'tournament not found'; end if;
  if v_t.status <> 'REGISTRATION_OPEN' then raise exception 'registration is closed'; end if;
  if v_t.registration_deadline is not null and now() > v_t.registration_deadline then
    raise exception 'registration deadline passed';
  end if;

  select * into v_player from public.players
    where club_id = v_t.club_id and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'player profile not found'; end if;
  if v_player.status <> 'ACTIVE' then raise exception 'player is not active'; end if;

  if v_t.max_participants is not null then
    select count(*) into v_count from public.tournament_participants
      where tournament_id = p_tournament_id and status = 'REGISTERED';
    if v_count >= v_t.max_participants then raise exception 'tournament is full'; end if;
  end if;

  insert into public.tournament_participants (club_id, tournament_id, player_id)
  values (v_t.club_id, p_tournament_id, v_player.id)
  on conflict (tournament_id, player_id) do update
    set status = 'REGISTERED', withdrawn_at = null, registered_at = now()
    where public.tournament_participants.status = 'WITHDRAWN'
  returning id into v_id;
  if v_id is null then raise exception 'already registered' using errcode = '23505'; end if;
  return v_id;
end $$;

create or replace function public.withdraw_from_tournament(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments%rowtype;
begin
  select * into v_t from public.tournaments where id = p_tournament_id and deleted_at is null;
  if not found then raise exception 'tournament not found'; end if;
  if v_t.status not in ('REGISTRATION_OPEN', 'REGISTRATION_CLOSED') then
    raise exception 'cannot withdraw after bracket is locked';
  end if;
  update public.tournament_participants tp
    set status = 'WITHDRAWN', withdrawn_at = now()
    from public.players p
    where tp.tournament_id = p_tournament_id and tp.player_id = p.id and p.user_id = auth.uid()
      and tp.status = 'REGISTERED';
end $$;

-- ---------- RPC: admin sets tournament status (open/close registration, cancel) ----------
create or replace function public.admin_set_tournament_status(p_tournament_id uuid, p_status public.tournament_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments%rowtype;
begin
  select * into v_t from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found then raise exception 'tournament not found'; end if;
  if not public.is_club_admin(v_t.club_id) then raise exception 'forbidden' using errcode = '42501'; end if;

  -- allowed transitions (bracket lock and completion go through dedicated RPCs)
  if not (
    (v_t.status = 'DRAFT' and p_status in ('REGISTRATION_OPEN', 'CANCELLED')) or
    (v_t.status = 'REGISTRATION_OPEN' and p_status in ('REGISTRATION_CLOSED', 'CANCELLED')) or
    (v_t.status = 'REGISTRATION_CLOSED' and p_status in ('REGISTRATION_OPEN', 'CANCELLED')) or
    (v_t.status = 'IN_PROGRESS' and p_status = 'CANCELLED')
  ) then
    raise exception 'transition % -> % not allowed', v_t.status, p_status;
  end if;

  update public.tournaments set status = p_status where id = p_tournament_id;
  if p_status = 'CANCELLED' then
    update public.matches set status = 'CANCELLED' where tournament_id = p_tournament_id and status = 'PENDING';
  end if;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, before, after)
  values (v_t.club_id, auth.uid(), 'TOURNAMENT_STATUS_CHANGED', 'tournament', p_tournament_id::text,
          jsonb_build_object('status', v_t.status), jsonb_build_object('status', p_status));
end $$;

-- ---------- RPC: admin removes a participant before lock ----------
create or replace function public.admin_remove_participant(p_participant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tp public.tournament_participants%rowtype;
  v_t  public.tournaments%rowtype;
begin
  select * into v_tp from public.tournament_participants where id = p_participant_id for update;
  if not found then raise exception 'participant not found'; end if;
  if not public.is_club_admin(v_tp.club_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_t from public.tournaments where id = v_tp.tournament_id;
  if v_t.status not in ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED') then
    raise exception 'bracket already locked';
  end if;
  update public.tournament_participants set status = 'WITHDRAWN', withdrawn_at = now() where id = p_participant_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, before, after)
  values (v_tp.club_id, auth.uid(), 'PARTICIPANT_REMOVED', 'tournament_participant', p_participant_id::text,
          jsonb_build_object('status', v_tp.status), jsonb_build_object('status', 'WITHDRAWN'));
end $$;

-- ---------- RPC: lock bracket (spec §23, §72) ----------
-- p_bracket: {
--   size: int, average_rating: numeric|null, k: numeric|null,
--   seeds: [{player_id, seed, rating, rating_status}],
--   matches: [{round, position, player1_id|null, player2_id|null}]
-- }
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

  -- snapshot participants
  for v_s in select * from jsonb_array_elements(p_bracket -> 'seeds') loop
    update public.tournament_participants
      set seed = (v_s ->> 'seed')::int,
          rating_at_lock = (v_s ->> 'rating')::numeric,
          rating_status_at_lock = (v_s ->> 'rating_status')::public.rating_status
      where tournament_id = p_tournament_id and player_id = (v_s ->> 'player_id')::uuid and status = 'REGISTERED';
    if not found then raise exception 'seed refers to unknown participant %', v_s ->> 'player_id'; end if;
  end loop;

  -- create matches
  for v_m in select * from jsonb_array_elements(p_bracket -> 'matches') loop
    insert into public.matches (club_id, match_type, tournament_id, round, position, player1_id, player2_id, created_by)
    values (v_t.club_id, 'TOURNAMENT', p_tournament_id,
            (v_m ->> 'round')::int, (v_m ->> 'position')::int,
            nullif(v_m ->> 'player1_id', '')::uuid, nullif(v_m ->> 'player2_id', '')::uuid, auth.uid());
  end loop;

  -- link next_match: match (r, p) -> (r+1, ceil(p/2)), slot = 1 if p odd else 2
  select max(round) into v_rounds from public.matches where tournament_id = p_tournament_id;
  update public.matches m
    set next_match_id = n.id,
        next_slot = case when m.position % 2 = 1 then 1 else 2 end
    from public.matches n
    where m.tournament_id = p_tournament_id and n.tournament_id = p_tournament_id
      and n.round = m.round + 1 and n.position = (m.position + 1) / 2
      and m.round < v_rounds;

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
          jsonb_build_object('size', p_bracket ->> 'size', 'participants', v_registered,
                             'average_rating', p_bracket ->> 'average_rating', 'k', p_bracket ->> 'k'));
end $$;

-- ---------- internal: apply rating deltas for a confirmed match ----------
-- p_deltas: [{player_id, rating_before, delta, rating_after, status_before, status_after, calc}]
-- Validates rating_before against the live projection to reject stale calculations.
create or replace function public._apply_match_rating(
  p_match public.matches, p_event_id uuid, p_reason public.rating_tx_reason, p_deltas jsonb, p_version integer
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_d      jsonb;
  v_player public.players%rowtype;
begin
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
end $$;

-- ---------- RPC: enter tournament match result (spec §24, §43, §44) ----------
-- p_calc: engine output stored on the match. p_deltas: see _apply_match_rating. Empty array = unrated.
create or replace function public.admin_confirm_tournament_match(
  p_match_id uuid, p_winner_player_id uuid, p_winner_sets integer, p_loser_sets integer,
  p_rated boolean, p_calc jsonb, p_deltas jsonb, p_version integer default 1
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_m     public.matches%rowtype;
  v_loser uuid;
begin
  select * into v_m from public.matches where id = p_match_id and deleted_at is null for update;
  if not found then raise exception 'match not found'; end if;
  if not public.is_club_admin(v_m.club_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_m.status = 'CONFIRMED' then return; end if;  -- idempotent (spec §65 "entered twice")
  if v_m.status <> 'PENDING' then raise exception 'match is %', v_m.status; end if;
  if v_m.player1_id is null or v_m.player2_id is null then raise exception 'both players must be known'; end if;
  if p_winner_player_id not in (v_m.player1_id, v_m.player2_id) then raise exception 'winner is not in this match'; end if;
  if p_winner_sets is null or p_loser_sets is null or p_winner_sets <= p_loser_sets or p_loser_sets < 0 then
    raise exception 'invalid score';
  end if;
  v_loser := case when p_winner_player_id = v_m.player1_id then v_m.player2_id else v_m.player1_id end;

  update public.matches
    set status = 'CONFIRMED', winner_player_id = p_winner_player_id, loser_player_id = v_loser,
        winner_sets = p_winner_sets, loser_sets = p_loser_sets, rated = p_rated, calc = p_calc,
        played_at = coalesce(played_at, now()), confirmed_by = auth.uid(), confirmed_at = now()
    where id = p_match_id
    returning * into v_m;

  if p_rated then
    perform public._apply_match_rating(v_m, v_m.event_id, 'TOURNAMENT_MATCH', p_deltas, p_version);
  end if;

  -- advance winner (spec §87 "results advance players automatically")
  if v_m.next_match_id is not null then
    if v_m.next_slot = 1 then
      update public.matches set player1_id = p_winner_player_id where id = v_m.next_match_id;
    else
      update public.matches set player2_id = p_winner_player_id where id = v_m.next_match_id;
    end if;
  end if;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_m.club_id, auth.uid(), 'MATCH_CONFIRMED', 'match', p_match_id::text,
          jsonb_build_object('winner', p_winner_player_id, 'score', p_winner_sets || ':' || p_loser_sets, 'rated', p_rated));
end $$;

-- ---------- RPC: correct a confirmed tournament match (spec §32, §45) ----------
-- Allowed only while the next match has no result yet. Reverses old transactions, applies new ones.
create or replace function public.admin_correct_tournament_match(
  p_match_id uuid, p_winner_player_id uuid, p_winner_sets integer, p_loser_sets integer,
  p_rated boolean, p_calc jsonb, p_deltas jsonb, p_reason text, p_version integer default 1
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_m       public.matches%rowtype;
  v_next    public.matches%rowtype;
  v_tx      public.rating_transactions%rowtype;
  v_player  public.players%rowtype;
  v_rev_evt uuid := gen_random_uuid();
  v_new_evt uuid := gen_random_uuid();
  v_old_winner uuid;
  v_loser   uuid;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'reason required'; end if;
  select * into v_m from public.matches where id = p_match_id and deleted_at is null for update;
  if not found then raise exception 'match not found'; end if;
  if not public.is_club_admin(v_m.club_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_m.status <> 'CONFIRMED' then raise exception 'only confirmed matches can be corrected'; end if;
  if v_m.next_match_id is not null then
    select * into v_next from public.matches where id = v_m.next_match_id for update;
    if v_next.status <> 'PENDING' then
      raise exception 'next match already has a result — use tournament recalculation';
    end if;
  end if;
  if p_winner_player_id not in (v_m.player1_id, v_m.player2_id) then raise exception 'winner is not in this match'; end if;
  if p_winner_sets <= p_loser_sets or p_loser_sets < 0 then raise exception 'invalid score'; end if;
  v_old_winner := v_m.winner_player_id;
  v_loser := case when p_winner_player_id = v_m.player1_id then v_m.player2_id else v_m.player1_id end;

  -- 1. reverse previous transactions (most recent first per player)
  for v_tx in select * from public.rating_transactions where match_id = p_match_id and reason <> 'REVERSAL'
              and not exists (select 1 from public.rating_transactions r where r.reverses_id = public.rating_transactions.id)
  loop
    select * into v_player from public.players where id = v_tx.player_id for update;
    insert into public.rating_transactions
      (club_id, player_id, event_id, reason, match_id, tournament_id, reverses_id, rating_before, rating_delta, rating_after,
       rating_status_before, rating_status_after, calc, calculation_version, note, created_by)
    values
      (v_tx.club_id, v_tx.player_id, v_rev_evt, 'REVERSAL', v_tx.match_id, v_tx.tournament_id, v_tx.id,
       v_player.current_rating, -v_tx.rating_delta, v_player.current_rating - v_tx.rating_delta,
       v_player.rating_status, v_player.rating_status,
       jsonb_build_object('reverses', v_tx.id), v_tx.calculation_version, p_reason, auth.uid());
    update public.players set current_rating = v_player.current_rating - v_tx.rating_delta where id = v_player.id;
  end loop;

  -- 2. apply corrected result
  update public.matches
    set winner_player_id = p_winner_player_id, loser_player_id = v_loser,
        winner_sets = p_winner_sets, loser_sets = p_loser_sets, rated = p_rated, calc = p_calc,
        corrected_at = now(), event_id = v_new_evt
    where id = p_match_id
    returning * into v_m;
  if p_rated then
    perform public._apply_match_rating(v_m, v_new_evt, 'TOURNAMENT_MATCH', p_deltas, p_version);
  end if;

  -- 3. fix bracket advancement
  if v_m.next_match_id is not null and v_old_winner is distinct from p_winner_player_id then
    if v_m.next_slot = 1 then
      update public.matches set player1_id = p_winner_player_id where id = v_m.next_match_id;
    else
      update public.matches set player2_id = p_winner_player_id where id = v_m.next_match_id;
    end if;
  end if;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, before, after, reason)
  values (v_m.club_id, auth.uid(), 'MATCH_CORRECTED', 'match', p_match_id::text,
          jsonb_build_object('winner', v_old_winner),
          jsonb_build_object('winner', p_winner_player_id, 'score', p_winner_sets || ':' || p_loser_sets), p_reason);
end $$;

-- ---------- RPC: complete tournament (spec §21.1 step 10, §15 newcomer initial rating, §16) ----------
-- p_newcomers: [{player_id, rating, calc}] initial ratings for NEW players (computed in TS). May be empty.
create or replace function public.admin_complete_tournament(p_tournament_id uuid, p_newcomers jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t       public.tournaments%rowtype;
  v_pending integer;
  v_final   public.matches%rowtype;
  v_n       jsonb;
  v_player  public.players%rowtype;
  v_tp      record;
  v_count   integer;
begin
  select * into v_t from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found then raise exception 'tournament not found'; end if;
  if not public.is_club_admin(v_t.club_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_t.status = 'COMPLETED' then return; end if;
  if v_t.status <> 'IN_PROGRESS' then raise exception 'tournament is %', v_t.status; end if;

  select count(*) into v_pending from public.matches
    where tournament_id = p_tournament_id and status = 'PENDING' and deleted_at is null;
  if v_pending > 0 then raise exception '% matches still pending', v_pending; end if;

  select * into v_final from public.matches
    where tournament_id = p_tournament_id and deleted_at is null
    order by round desc, position asc limit 1;

  -- newcomer initial ratings
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

  -- tournament_count + status transitions for everyone who played
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

  update public.tournaments
    set status = 'COMPLETED', completed_at = now(), winner_player_id = v_final.winner_player_id
    where id = p_tournament_id;
  update public.tournament_participants set final_place = 1
    where tournament_id = p_tournament_id and player_id = v_final.winner_player_id;
  update public.tournament_participants set final_place = 2
    where tournament_id = p_tournament_id and player_id = v_final.loser_player_id;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_t.club_id, auth.uid(), 'TOURNAMENT_COMPLETED', 'tournament', p_tournament_id::text,
          jsonb_build_object('winner', v_final.winner_player_id, 'newcomers_rated', jsonb_array_length(p_newcomers)));
end $$;

-- ---------- grants ----------
revoke execute on function public._apply_match_rating(public.matches, uuid, public.rating_tx_reason, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.tournament_status_after_count(integer, uuid) from public, anon, authenticated;
grant execute on function
  public.register_for_tournament(uuid),
  public.withdraw_from_tournament(uuid),
  public.admin_set_tournament_status(uuid, public.tournament_status),
  public.admin_remove_participant(uuid),
  public.admin_lock_bracket(uuid, jsonb),
  public.admin_confirm_tournament_match(uuid, uuid, integer, integer, boolean, jsonb, jsonb, integer),
  public.admin_correct_tournament_match(uuid, uuid, integer, integer, boolean, jsonb, jsonb, text, integer),
  public.admin_complete_tournament(uuid, jsonb)
  to authenticated;

-- ---------- player W/L stats view (spec §27, §28) ----------
create or replace view public.player_match_stats with (security_invoker = true) as
select
  p.id as player_id,
  p.club_id,
  count(m.id) filter (where m.winner_player_id = p.id) as wins,
  count(m.id) filter (where m.loser_player_id = p.id) as losses
from public.players p
left join public.matches m
  on m.status = 'CONFIRMED' and m.deleted_at is null and (m.winner_player_id = p.id or m.loser_player_id = p.id)
group by p.id, p.club_id;
grant select on public.player_match_stats to authenticated;
