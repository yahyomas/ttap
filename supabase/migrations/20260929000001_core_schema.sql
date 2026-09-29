-- TT Club Platform — core schema (Phase 1 + rating foundation for Phase 2)
-- Conventions: all timestamps timestamptz, tenant = club_id, soft delete via deleted_at.

create extension if not exists citext with schema extensions;

-- ---------- enums ----------
create type public.playing_hand as enum ('RIGHT', 'LEFT');
create type public.gender as enum ('MALE', 'FEMALE');
create type public.rating_status as enum ('NEW', 'PROVISIONAL', 'ESTABLISHED');
create type public.player_status as enum ('PENDING', 'ACTIVE', 'BLOCKED');
create type public.club_role as enum ('PLAYER', 'ADMIN');
create type public.external_rating_source as enum ('RTTF');
create type public.verification_status as enum ('PENDING', 'VERIFIED', 'REJECTED');
create type public.rating_tx_reason as enum (
  'TOURNAMENT_MATCH', 'CHALLENGE_MATCH', 'CASUAL_MATCH',
  'NEWCOMER_INITIAL', 'EXTERNAL_SEED', 'MANUAL_ADJUSTMENT', 'REVERSAL'
);

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- clubs ----------
create table public.clubs (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  timezone    text not null default 'Asia/Tashkent',
  -- club-level business rules (spec §99). Defaults = agreed RTTF-like model.
  settings    jsonb not null default '{
    "rating": {
      "algorithm": "RTTF_LIKE",
      "version": 1,
      "k_by_avg_rating": [
        {"max": 250, "k": 0.20},
        {"max": 350, "k": 0.25},
        {"max": 450, "k": 0.30},
        {"max": 550, "k": 0.35},
        {"max": null, "k": 0.40}
      ],
      "challenge_k": 0.30,
      "d_by_sets": {"3:2": 0.8, "2:1": 0.8, "3:1": 1.0, "2:0": 1.0, "3:0": 1.2},
      "big_gap_threshold": 100,
      "newcomer_tournaments": 5,
      "newcomer_win_k": 1.0,
      "newcomer_loss_k": 0.5,
      "newcomer_initial_step": 25,
      "newcomer_initial_min": 100,
      "rounding": "HALF_UP_INTEGER",
      "rated_match_types": ["TOURNAMENT", "CHALLENGE"],
      "external_seed_policy": "USE_VERIFIED_AS_PROVISIONAL"
    },
    "privacy": {"show_playing_hand": true}
  }'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger clubs_updated_at before update on public.clubs
  for each row execute function public.set_updated_at();

-- ---------- users (mirror of auth.users; account-level data, spec §7.1) ----------
create table public.users (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              citext unique,
  phone              text unique,
  notification_prefs jsonb not null default '{
    "challenge": true, "tournament": true, "match": true, "rating": true
  }'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, phone)
  values (new.id, nullif(new.email, ''), nullif(new.phone, ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------- club memberships (roles per club, spec §36, §101) ----------
create table public.club_memberships (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  role       public.club_role not null default 'PLAYER',
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);
create index club_memberships_user_idx on public.club_memberships(user_id);

-- ---------- players (sport entity, spec §7.1, §8) ----------
create table public.players (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  user_id          uuid references public.users(id) on delete set null,
  first_name       text not null,
  last_name        text not null,
  display_name     text not null,
  birth_date       date,
  gender           public.gender,
  playing_hand     public.playing_hand not null,
  avatar_url       text,
  status           public.player_status not null default 'PENDING',
  -- Club Rating projection (spec §96). NULL until first rated result (§17).
  current_rating   numeric(8,2),
  peak_rating      numeric(8,2),
  rating_status    public.rating_status not null default 'NEW',
  tournament_count integer not null default 0 check (tournament_count >= 0),
  approved_at      timestamptz,
  approved_by      uuid references public.users(id),
  blocked_at       timestamptz,
  blocked_reason   text,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (current_rating is null or current_rating > 0),
  check ((rating_status = 'NEW') = (current_rating is null))
);
create unique index players_one_active_per_user_club
  on public.players(club_id, user_id) where deleted_at is null and user_id is not null;
create index players_club_rating_idx
  on public.players(club_id, current_rating desc nulls last) where deleted_at is null;
create index players_club_status_idx on public.players(club_id, status);
create trigger players_updated_at before update on public.players
  for each row execute function public.set_updated_at();

-- ---------- external ratings (spec §9, §47) ----------
create table public.player_external_ratings (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  source        public.external_rating_source not null default 'RTTF',
  rating        integer not null check (rating > 0),
  status        public.verification_status not null default 'PENDING',
  external_ref  text,
  verified_by   uuid references public.users(id),
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (player_id, source)
);
create trigger per_updated_at before update on public.player_external_ratings
  for each row execute function public.set_updated_at();

-- ---------- rating transactions (source of truth, spec §25, §42, §43, §60) ----------
create table public.rating_transactions (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade,
  player_id            uuid not null references public.players(id) on delete cascade,
  -- idempotency: one event applies to a player at most once
  event_id             uuid not null,
  reason               public.rating_tx_reason not null,
  match_id             uuid,          -- FK added in matches migration
  tournament_id        uuid,          -- FK added in tournaments migration
  reverses_id          uuid references public.rating_transactions(id),
  rating_before        numeric(8,2),  -- NULL for first rating
  rating_delta         numeric(8,2) not null,
  rating_after         numeric(8,2) not null check (rating_after > 0),
  rating_status_before public.rating_status not null,
  rating_status_after  public.rating_status not null,
  -- calculation inputs (spec §60)
  calc                 jsonb not null default '{}'::jsonb,
  calculation_version  integer not null default 1,
  note                 text,
  created_by           uuid references public.users(id),
  created_at           timestamptz not null default now(),
  unique (event_id, player_id)
);
create index rating_tx_player_idx on public.rating_transactions(player_id, created_at desc);
create index rating_tx_club_created_idx on public.rating_transactions(club_id, created_at desc);

-- ---------- audit log (spec §52, §74) ----------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  club_id     uuid references public.clubs(id) on delete cascade,
  actor_id    uuid references public.users(id),
  action      text not null,
  entity_type text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  reason      text,
  created_at  timestamptz not null default now()
);
create index audit_logs_club_created_idx on public.audit_logs(club_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

-- ---------- auth helpers for RLS ----------
create or replace function public.current_club_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select club_id from public.club_memberships where user_id = auth.uid();
$$;

create or replace function public.is_club_admin(p_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_memberships
    where user_id = auth.uid() and club_id = p_club_id and role = 'ADMIN'
  );
$$;

create or replace function public.is_club_member(p_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_memberships
    where user_id = auth.uid() and club_id = p_club_id
  );
$$;

-- ---------- RLS ----------
alter table public.clubs enable row level security;
alter table public.users enable row level security;
alter table public.club_memberships enable row level security;
alter table public.players enable row level security;
alter table public.player_external_ratings enable row level security;
alter table public.rating_transactions enable row level security;
alter table public.audit_logs enable row level security;

-- clubs: readable by anyone (public club page), editable by admins
create policy clubs_select on public.clubs for select using (true);
create policy clubs_update on public.clubs for update using (public.is_club_admin(id));

-- users: self only
create policy users_select_self on public.users for select using (id = auth.uid());
create policy users_update_self on public.users for update using (id = auth.uid());

-- memberships: own rows, admins see whole club. Inserts only via RPC (security definer).
create policy memberships_select on public.club_memberships for select
  using (user_id = auth.uid() or public.is_club_admin(club_id));
create policy memberships_admin_write on public.club_memberships for all
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

-- players: active players visible to members; own row visible always; admins full.
create policy players_select on public.players for select
  using (
    deleted_at is null and (
      user_id = auth.uid()
      or (status = 'ACTIVE' and public.is_club_member(club_id))
      or public.is_club_admin(club_id)
    )
  );
create policy players_update_self on public.players for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy players_admin_all on public.players for all
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

-- external ratings: own + admin
create policy ext_ratings_select on public.player_external_ratings for select
  using (
    exists (select 1 from public.players p where p.id = player_id and p.user_id = auth.uid())
    or public.is_club_admin(club_id)
  );
create policy ext_ratings_admin_all on public.player_external_ratings for all
  using (public.is_club_admin(club_id)) with check (public.is_club_admin(club_id));

-- rating transactions: members read (rating history is public within club); writes only server-side
create policy rating_tx_select on public.rating_transactions for select
  using (public.is_club_member(club_id));

-- audit logs: admins read only
create policy audit_select_admin on public.audit_logs for select
  using (public.is_club_admin(club_id));

-- ---------- column-level protection for self-updates ----------
-- Players may edit profile fields only; rating/status columns are server-owned.
create or replace function public.guard_player_self_update()
returns trigger language plpgsql as $$
begin
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
create trigger players_guard_self_update before update on public.players
  for each row execute function public.guard_player_self_update();

-- ---------- RPC: onboarding (spec §46) ----------
-- Creates player (PENDING) + PLAYER membership + optional RTTF rating (PENDING) atomically.
create or replace function public.complete_onboarding(
  p_club_slug     text,
  p_first_name    text,
  p_last_name     text,
  p_display_name  text,
  p_birth_date    date,
  p_gender        public.gender,
  p_playing_hand  public.playing_hand,
  p_rttf_rating   integer default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_club_id   uuid;
  v_player_id uuid;
  v_uid       uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select id into v_club_id from public.clubs where slug = p_club_slug;
  if v_club_id is null then
    raise exception 'club not found';
  end if;
  if exists (select 1 from public.players where club_id = v_club_id and user_id = v_uid and deleted_at is null) then
    raise exception 'player already exists' using errcode = '23505';
  end if;

  insert into public.club_memberships (club_id, user_id, role)
  values (v_club_id, v_uid, 'PLAYER')
  on conflict (club_id, user_id) do nothing;

  insert into public.players (club_id, user_id, first_name, last_name, display_name,
                              birth_date, gender, playing_hand)
  values (v_club_id, v_uid, trim(p_first_name), trim(p_last_name), trim(p_display_name),
          p_birth_date, p_gender, p_playing_hand)
  returning id into v_player_id;

  if p_rttf_rating is not null then
    insert into public.player_external_ratings (club_id, player_id, source, rating)
    values (v_club_id, v_player_id, 'RTTF', p_rttf_rating);
  end if;

  return v_player_id;
end $$;

-- ---------- RPC: admin approve player (spec §5.2, audit §74) ----------
create or replace function public.admin_approve_player(p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_player public.players%rowtype;
begin
  select * into v_player from public.players where id = p_player_id for update;
  if not found then raise exception 'player not found'; end if;
  if not public.is_club_admin(v_player.club_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_player.status <> 'PENDING' then
    return; -- idempotent
  end if;
  update public.players
    set status = 'ACTIVE', approved_at = now(), approved_by = auth.uid()
    where id = p_player_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, before, after)
  values (v_player.club_id, auth.uid(), 'PLAYER_APPROVED', 'player', p_player_id::text,
          jsonb_build_object('status', v_player.status), jsonb_build_object('status', 'ACTIVE'));
end $$;

-- ---------- RPC: admin block / unblock ----------
create or replace function public.admin_set_player_blocked(p_player_id uuid, p_blocked boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_player public.players%rowtype;
begin
  select * into v_player from public.players where id = p_player_id for update;
  if not found then raise exception 'player not found'; end if;
  if not public.is_club_admin(v_player.club_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_blocked then
    update public.players set status = 'BLOCKED', blocked_at = now(), blocked_reason = p_reason where id = p_player_id;
  else
    update public.players set status = 'ACTIVE', blocked_at = null, blocked_reason = null where id = p_player_id;
  end if;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, before, after, reason)
  values (v_player.club_id, auth.uid(), case when p_blocked then 'PLAYER_BLOCKED' else 'PLAYER_UNBLOCKED' end,
          'player', p_player_id::text,
          jsonb_build_object('status', v_player.status),
          jsonb_build_object('status', case when p_blocked then 'BLOCKED' else 'ACTIVE' end), p_reason);
end $$;

-- ---------- RPC: admin verify external rating (spec §9, §47, §48, §100) ----------
-- Policy USE_VERIFIED_AS_PROVISIONAL: verified RTTF seeds Club Rating with status PROVISIONAL
-- via an EXTERNAL_SEED rating transaction, only if player has no rating yet.
create or replace function public.admin_verify_external_rating(p_rating_id uuid, p_verdict public.verification_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ext    public.player_external_ratings%rowtype;
  v_player public.players%rowtype;
  v_policy text;
  v_event  uuid := gen_random_uuid();
begin
  select * into v_ext from public.player_external_ratings where id = p_rating_id for update;
  if not found then raise exception 'external rating not found'; end if;
  if not public.is_club_admin(v_ext.club_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_verdict = 'PENDING' then raise exception 'invalid verdict'; end if;

  update public.player_external_ratings
    set status = p_verdict, verified_by = auth.uid(), verified_at = now()
    where id = p_rating_id;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, before, after)
  values (v_ext.club_id, auth.uid(),
          case when p_verdict = 'VERIFIED' then 'EXTERNAL_RATING_VERIFIED' else 'EXTERNAL_RATING_REJECTED' end,
          'player_external_rating', p_rating_id::text,
          jsonb_build_object('status', v_ext.status, 'rating', v_ext.rating),
          jsonb_build_object('status', p_verdict));

  if p_verdict = 'VERIFIED' then
    select c.settings #>> '{rating,external_seed_policy}' into v_policy
      from public.clubs c where c.id = v_ext.club_id;
    select * into v_player from public.players where id = v_ext.player_id for update;

    if v_policy = 'USE_VERIFIED_AS_PROVISIONAL' and v_player.current_rating is null then
      insert into public.rating_transactions
        (club_id, player_id, event_id, reason, rating_before, rating_delta, rating_after,
         rating_status_before, rating_status_after, calc, created_by)
      values
        (v_ext.club_id, v_ext.player_id, v_event, 'EXTERNAL_SEED', null, v_ext.rating, v_ext.rating,
         v_player.rating_status, 'PROVISIONAL',
         jsonb_build_object('source', v_ext.source, 'external_rating', v_ext.rating, 'policy', v_policy),
         auth.uid());
      update public.players
        set current_rating = v_ext.rating, peak_rating = v_ext.rating, rating_status = 'PROVISIONAL'
        where id = v_ext.player_id;
    end if;
  end if;
end $$;

-- ---------- RPC: manual rating adjustment (spec §75) ----------
create or replace function public.admin_adjust_rating(p_player_id uuid, p_new_rating numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_player public.players%rowtype;
  v_event  uuid := gen_random_uuid();
  v_tx_id  uuid;
  v_status public.rating_status;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'reason required';
  end if;
  if p_new_rating is null or p_new_rating <= 0 then
    raise exception 'rating must be positive';
  end if;
  select * into v_player from public.players where id = p_player_id for update;
  if not found then raise exception 'player not found'; end if;
  if not public.is_club_admin(v_player.club_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_status := case when v_player.rating_status = 'NEW' then 'PROVISIONAL' else v_player.rating_status end;

  insert into public.rating_transactions
    (club_id, player_id, event_id, reason, rating_before, rating_delta, rating_after,
     rating_status_before, rating_status_after, note, created_by)
  values
    (v_player.club_id, p_player_id, v_event, 'MANUAL_ADJUSTMENT',
     v_player.current_rating, p_new_rating - coalesce(v_player.current_rating, 0), p_new_rating,
     v_player.rating_status, v_status, p_reason, auth.uid())
  returning id into v_tx_id;

  update public.players
    set current_rating = p_new_rating,
        peak_rating = greatest(coalesce(peak_rating, 0), p_new_rating),
        rating_status = v_status
    where id = p_player_id;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, before, after, reason)
  values (v_player.club_id, auth.uid(), 'RATING_MANUALLY_ADJUSTED', 'player', p_player_id::text,
          jsonb_build_object('rating', v_player.current_rating),
          jsonb_build_object('rating', p_new_rating, 'transaction_id', v_tx_id), p_reason);
  return v_tx_id;
end $$;

-- ---------- leaderboard view (spec §27). W/L filled in once matches exist. ----------
create or replace view public.leaderboard with (security_invoker = true) as
select
  p.club_id,
  p.id as player_id,
  p.display_name,
  p.playing_hand,
  p.current_rating,
  p.rating_status,
  dense_rank() over (partition by p.club_id order by p.current_rating desc) as rank
from public.players p
where p.deleted_at is null and p.status = 'ACTIVE' and p.current_rating is not null;

-- ---------- grants ----------
grant usage on schema public to anon, authenticated;
grant select on public.clubs, public.leaderboard to anon, authenticated;
grant select, insert, update on public.users, public.players, public.player_external_ratings,
  public.club_memberships to authenticated;
grant select on public.rating_transactions, public.audit_logs to authenticated;
grant execute on function public.complete_onboarding, public.admin_approve_player,
  public.admin_set_player_blocked, public.admin_verify_external_rating,
  public.admin_adjust_rating to authenticated;
