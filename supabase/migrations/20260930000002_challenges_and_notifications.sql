-- Phase 4: challenges (spec §20, §51, §86) + in-app notification outbox (spec §53, §98)
--
-- Flow: PENDING → ACCEPTED → RESULT_SUBMITTED → COMPLETED
--                 ↘ DECLINED / CANCELLED / EXPIRED
-- Result confirmation (spec §51): one player submits, the other confirms. The other may reject
-- (back to ACCEPTED with a note). After `challenge_confirm_hours` (club setting, default 48) the
-- submitter may confirm by timeout; an admin may confirm at any time.
-- Rating: same TS engine; challenge k = settings.rating.challenge_k; a NEW player makes the
-- match unrated for both sides (product decision).

create type public.challenge_status as enum (
  'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'RESULT_SUBMITTED', 'COMPLETED'
);

create table public.challenges (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  challenger_id  uuid not null references public.players(id),
  opponent_id    uuid not null references public.players(id),
  status         public.challenge_status not null default 'PENDING',
  proposed_at    timestamptz not null,
  message        text,
  match_id       uuid references public.matches(id),
  submitted_by   uuid references public.players(id),
  submitted_at   timestamptz,
  dispute_note   text,
  responded_at   timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);
create index challenges_club_status_idx on public.challenges(club_id, status);
create index challenges_challenger_idx on public.challenges(challenger_id);
create index challenges_opponent_idx on public.challenges(opponent_id);
-- one open challenge per pair (either direction)
create unique index challenges_open_pair_idx
  on public.challenges (club_id, least(challenger_id, opponent_id), greatest(challenger_id, opponent_id))
  where status in ('PENDING', 'ACCEPTED', 'RESULT_SUBMITTED');
create trigger challenges_updated_at before update on public.challenges
  for each row execute function public.set_updated_at();

alter table public.matches
  add constraint matches_challenge_fkey foreign key (challenge_id) references public.challenges(id);
alter table public.matches add column if not exists submitted_by uuid references public.players(id);

-- ---------- notifications (outbox; Telegram delivery in Phase 5) ----------
create type public.notification_kind as enum (
  'CHALLENGE_CREATED', 'CHALLENGE_ACCEPTED', 'CHALLENGE_DECLINED', 'CHALLENGE_CANCELLED',
  'CHALLENGE_RESULT_SUBMITTED', 'CHALLENGE_RESULT_REJECTED', 'CHALLENGE_COMPLETED',
  'TOURNAMENT_REGISTRATION_OPEN', 'BRACKET_LOCKED', 'TOURNAMENT_MATCH_CONFIRMED', 'TOURNAMENT_COMPLETED',
  'RATING_CHANGED', 'PLAYER_APPROVED', 'EXTERNAL_RATING_VERIFIED'
);

create table public.notifications (
  id            bigint generated always as identity primary key,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  kind          public.notification_kind not null,
  title         text not null,
  body          text,
  link          text,
  payload       jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  telegram_sent_at timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unsent_idx on public.notifications(created_at) where telegram_sent_at is null;

alter table public.challenges enable row level security;
alter table public.notifications enable row level security;

create policy challenges_select on public.challenges for select
  using (
    public.is_club_admin(club_id)
    or exists (select 1 from public.players p where p.user_id = auth.uid() and p.id in (challenger_id, opponent_id))
  );
create policy notifications_select_self on public.notifications for select using (user_id = auth.uid());
create policy notifications_update_self on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.challenges to authenticated;
grant select, update on public.notifications to authenticated;

-- ---------- helpers ----------
create or replace function public._notify(
  p_club_id uuid, p_player_id uuid, p_kind public.notification_kind, p_title text, p_body text, p_link text, p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.players where id = p_player_id;
  if v_user is null then return; end if;
  insert into public.notifications (club_id, user_id, kind, title, body, link, payload)
  values (p_club_id, v_user, p_kind, p_title, p_body, p_link, p_payload);
end $$;
revoke execute on function public._notify(uuid, uuid, public.notification_kind, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public._current_player(p_club_id uuid)
returns public.players language sql stable security definer set search_path = public as $$
  select * from public.players where club_id = p_club_id and user_id = auth.uid() and deleted_at is null limit 1;
$$;
revoke execute on function public._current_player(uuid) from public, anon, authenticated;

-- ---------- RPC: create ----------
create or replace function public.create_challenge(p_opponent_id uuid, p_proposed_at timestamptz, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_opp public.players%rowtype;
  v_me  public.players%rowtype;
  v_id  uuid;
begin
  select * into v_opp from public.players where id = p_opponent_id and deleted_at is null;
  if not found then raise exception 'opponent not found'; end if;
  v_me := public._current_player(v_opp.club_id);
  if v_me.id is null then raise exception 'player profile not found' using errcode = '42501'; end if;
  if v_me.id = v_opp.id then raise exception 'cannot challenge yourself'; end if;
  if v_me.status <> 'ACTIVE' then raise exception 'your account is not active'; end if;
  if v_opp.status <> 'ACTIVE' then raise exception 'opponent is not active'; end if;
  if p_proposed_at < now() - interval '1 hour' then raise exception 'proposed time is in the past'; end if;

  insert into public.challenges (club_id, challenger_id, opponent_id, proposed_at, message)
  values (v_me.club_id, v_me.id, v_opp.id, p_proposed_at, nullif(trim(p_message), ''))
  returning id into v_id;

  perform public._notify(v_me.club_id, v_opp.id, 'CHALLENGE_CREATED', 'Новый вызов от ' || v_me.display_name,
    to_char(p_proposed_at at time zone (select timezone from public.clubs where id = v_me.club_id), 'DD.MM HH24:MI') || coalesce(' — ' || nullif(trim(p_message), ''), ''),
    '/challenges/' || v_id, jsonb_build_object('challenge_id', v_id));
  return v_id;
exception when unique_violation then
  raise exception 'между вами уже есть активный вызов' using errcode = '23505';
end $$;

-- ---------- RPC: respond (opponent) ----------
create or replace function public.respond_challenge(p_challenge_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c  public.challenges%rowtype;
  v_me public.players%rowtype;
begin
  select * into v_c from public.challenges where id = p_challenge_id for update;
  if not found then raise exception 'challenge not found'; end if;
  v_me := public._current_player(v_c.club_id);
  if v_me.id is distinct from v_c.opponent_id then raise exception 'only the opponent can respond' using errcode = '42501'; end if;
  if v_c.status <> 'PENDING' then raise exception 'challenge is %', v_c.status; end if;

  update public.challenges set status = case when p_accept then 'ACCEPTED' else 'DECLINED' end::public.challenge_status,
    responded_at = now() where id = p_challenge_id;
  perform public._notify(v_c.club_id, v_c.challenger_id,
    case when p_accept then 'CHALLENGE_ACCEPTED' else 'CHALLENGE_DECLINED' end::public.notification_kind,
    v_me.display_name || case when p_accept then ' принял вызов' else ' отклонил вызов' end,
    null, '/challenges/' || p_challenge_id, jsonb_build_object('challenge_id', p_challenge_id));
end $$;

-- ---------- RPC: cancel (either party while open; admin any time) ----------
create or replace function public.cancel_challenge(p_challenge_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c  public.challenges%rowtype;
  v_me public.players%rowtype;
  v_admin boolean;
  v_other uuid;
begin
  select * into v_c from public.challenges where id = p_challenge_id for update;
  if not found then raise exception 'challenge not found'; end if;
  v_admin := public.is_club_admin(v_c.club_id);
  v_me := public._current_player(v_c.club_id);
  if not v_admin and (v_me.id is null or v_me.id not in (v_c.challenger_id, v_c.opponent_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_c.status not in ('PENDING', 'ACCEPTED', 'RESULT_SUBMITTED') then raise exception 'challenge is %', v_c.status; end if;
  if v_c.status = 'RESULT_SUBMITTED' and not v_admin then raise exception 'result already submitted — reject it instead'; end if;

  if v_c.match_id is not null then
    update public.matches set status = 'CANCELLED' where id = v_c.match_id and status = 'PENDING';
  end if;
  update public.challenges set status = 'CANCELLED', dispute_note = coalesce(p_reason, dispute_note) where id = p_challenge_id;

  v_other := case when v_me.id = v_c.challenger_id then v_c.opponent_id else v_c.challenger_id end;
  if v_admin and v_me.id is null then
    perform public._notify(v_c.club_id, v_c.challenger_id, 'CHALLENGE_CANCELLED', 'Вызов отменён администратором', p_reason, '/challenges/' || p_challenge_id);
    perform public._notify(v_c.club_id, v_c.opponent_id, 'CHALLENGE_CANCELLED', 'Вызов отменён администратором', p_reason, '/challenges/' || p_challenge_id);
  else
    perform public._notify(v_c.club_id, v_other, 'CHALLENGE_CANCELLED', coalesce(v_me.display_name, 'Соперник') || ' отменил вызов', p_reason, '/challenges/' || p_challenge_id);
  end if;
  if v_admin then
    insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, reason)
    values (v_c.club_id, auth.uid(), 'CHALLENGE_CANCELLED', 'challenge', p_challenge_id::text, p_reason);
  end if;
end $$;

-- ---------- RPC: submit result (either party) ----------
create or replace function public.submit_challenge_result(p_challenge_id uuid, p_winner_id uuid, p_winner_sets integer, p_loser_sets integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_c  public.challenges%rowtype;
  v_me public.players%rowtype;
  v_loser uuid;
  v_match uuid;
  v_other uuid;
begin
  select * into v_c from public.challenges where id = p_challenge_id for update;
  if not found then raise exception 'challenge not found'; end if;
  v_me := public._current_player(v_c.club_id);
  if v_me.id is null or v_me.id not in (v_c.challenger_id, v_c.opponent_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_c.status = 'RESULT_SUBMITTED' and v_c.submitted_by <> v_me.id then
    raise exception 'соперник уже внёс результат — подтвердите или отклоните его';
  end if;
  if v_c.status not in ('ACCEPTED', 'RESULT_SUBMITTED') then raise exception 'challenge is %', v_c.status; end if;
  if p_winner_id not in (v_c.challenger_id, v_c.opponent_id) then raise exception 'winner is not a participant'; end if;
  if p_winner_sets is null or p_loser_sets is null or p_winner_sets <= p_loser_sets or p_loser_sets < 0 then raise exception 'invalid score'; end if;
  v_loser := case when p_winner_id = v_c.challenger_id then v_c.opponent_id else v_c.challenger_id end;

  if v_c.match_id is not null then
    update public.matches
      set winner_player_id = p_winner_id, loser_player_id = v_loser, winner_sets = p_winner_sets, loser_sets = p_loser_sets,
          submitted_by = v_me.id, played_at = now()
      where id = v_c.match_id and status = 'PENDING';
    v_match := v_c.match_id;
  else
    insert into public.matches (club_id, match_type, status, challenge_id, player1_id, player2_id,
                                winner_player_id, loser_player_id, winner_sets, loser_sets, submitted_by, played_at, created_by)
    values (v_c.club_id, 'CHALLENGE', 'PENDING', p_challenge_id, v_c.challenger_id, v_c.opponent_id,
            p_winner_id, v_loser, p_winner_sets, p_loser_sets, v_me.id, now(), auth.uid())
    returning id into v_match;
  end if;

  update public.challenges set status = 'RESULT_SUBMITTED', match_id = v_match, submitted_by = v_me.id, submitted_at = now(), dispute_note = null
    where id = p_challenge_id;

  v_other := case when v_me.id = v_c.challenger_id then v_c.opponent_id else v_c.challenger_id end;
  perform public._notify(v_c.club_id, v_other, 'CHALLENGE_RESULT_SUBMITTED', v_me.display_name || ' внёс результат — подтвердите',
    (select display_name from public.players where id = p_winner_id) || ' выиграл ' || p_winner_sets || ':' || p_loser_sets,
    '/challenges/' || p_challenge_id, jsonb_build_object('challenge_id', p_challenge_id, 'match_id', v_match));
  return v_match;
end $$;

-- ---------- RPC: reject submitted result (the other party) ----------
create or replace function public.reject_challenge_result(p_challenge_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c  public.challenges%rowtype;
  v_me public.players%rowtype;
begin
  select * into v_c from public.challenges where id = p_challenge_id for update;
  if not found then raise exception 'challenge not found'; end if;
  v_me := public._current_player(v_c.club_id);
  if v_me.id is null or v_me.id not in (v_c.challenger_id, v_c.opponent_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_c.status <> 'RESULT_SUBMITTED' then raise exception 'no submitted result'; end if;
  if v_c.submitted_by = v_me.id then raise exception 'you submitted this result'; end if;

  update public.matches set status = 'CANCELLED' where id = v_c.match_id and status = 'PENDING';
  update public.challenges set status = 'ACCEPTED', match_id = null, submitted_by = null, submitted_at = null, dispute_note = nullif(trim(p_note), '')
    where id = p_challenge_id;
  perform public._notify(v_c.club_id, v_c.submitted_by, 'CHALLENGE_RESULT_REJECTED', v_me.display_name || ' не согласен с результатом',
    nullif(trim(p_note), ''), '/challenges/' || p_challenge_id, jsonb_build_object('challenge_id', p_challenge_id));
end $$;

-- ---------- RPC: confirm result → rating (spec §51, §44) ----------
-- Caller: the non-submitting player; OR admin; OR the submitter when the club's confirm window has passed.
create or replace function public.confirm_challenge_result(
  p_challenge_id uuid, p_rated boolean, p_calc jsonb, p_deltas jsonb, p_version integer default 1
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_c     public.challenges%rowtype;
  v_m     public.matches%rowtype;
  v_me    public.players%rowtype;
  v_admin boolean;
  v_hours integer;
  v_by_timeout boolean := false;
begin
  select * into v_c from public.challenges where id = p_challenge_id for update;
  if not found then raise exception 'challenge not found'; end if;
  if v_c.status = 'COMPLETED' then return; end if;  -- idempotent
  if v_c.status <> 'RESULT_SUBMITTED' or v_c.match_id is null then raise exception 'no submitted result'; end if;

  v_admin := public.is_club_admin(v_c.club_id);
  v_me := public._current_player(v_c.club_id);
  if not v_admin then
    if v_me.id is null or v_me.id not in (v_c.challenger_id, v_c.opponent_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    if v_me.id = v_c.submitted_by then
      select coalesce((settings #>> '{challenges,confirm_hours}')::int, 48) into v_hours from public.clubs where id = v_c.club_id;
      if now() < v_c.submitted_at + make_interval(hours => v_hours) then
        raise exception 'соперник ещё может подтвердить результат (до % ч.)', v_hours;
      end if;
      v_by_timeout := true;
    end if;
  end if;

  select * into v_m from public.matches where id = v_c.match_id for update;
  if v_m.status <> 'PENDING' then raise exception 'match is %', v_m.status; end if;

  update public.matches
    set status = 'CONFIRMED', rated = p_rated, calc = p_calc, confirmed_by = auth.uid(), confirmed_at = now()
    where id = v_m.id
    returning * into v_m;
  if p_rated then
    perform public._apply_match_rating(v_m, v_m.event_id, 'CHALLENGE_MATCH', p_deltas, p_version);
  end if;
  update public.challenges set status = 'COMPLETED', completed_at = now() where id = p_challenge_id;

  perform public._notify(v_c.club_id, v_c.challenger_id, 'CHALLENGE_COMPLETED', 'Результат подтверждён',
    case when p_rated then 'Рейтинг обновлён' else 'Матч без изменения рейтинга' end, '/challenges/' || p_challenge_id,
    jsonb_build_object('challenge_id', p_challenge_id, 'by_timeout', v_by_timeout));
  perform public._notify(v_c.club_id, v_c.opponent_id, 'CHALLENGE_COMPLETED', 'Результат подтверждён',
    case when p_rated then 'Рейтинг обновлён' else 'Матч без изменения рейтинга' end, '/challenges/' || p_challenge_id,
    jsonb_build_object('challenge_id', p_challenge_id, 'by_timeout', v_by_timeout));

  if v_admin or v_by_timeout then
    insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
    values (v_c.club_id, auth.uid(), 'MATCH_CONFIRMED', 'match', v_m.id::text,
            jsonb_build_object('challenge_id', p_challenge_id, 'by_admin', v_admin, 'by_timeout', v_by_timeout, 'rated', p_rated));
  end if;
end $$;

-- ---------- RPC: mark notifications read ----------
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
$$;

-- ---------- cron: expire unanswered challenges (pure SQL, no rating impact) ----------
create or replace function public.expire_challenges()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  with x as (
    update public.challenges set status = 'EXPIRED'
    where status = 'PENDING' and proposed_at < now()
    returning id, club_id, challenger_id, opponent_id
  )
  select count(*) into v_n from x;
  return v_n;
end $$;
revoke execute on function public.expire_challenges() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('expire-challenges', '*/15 * * * *', $$select public.expire_challenges()$$);

-- ---------- grants ----------
grant execute on function
  public.create_challenge(uuid, timestamptz, text),
  public.respond_challenge(uuid, boolean),
  public.cancel_challenge(uuid, text),
  public.submit_challenge_result(uuid, uuid, integer, integer),
  public.reject_challenge_result(uuid, text),
  public.confirm_challenge_result(uuid, boolean, jsonb, jsonb, integer),
  public.mark_notifications_read(bigint[])
  to authenticated;

-- club setting default
update public.clubs set settings = jsonb_set(settings, '{challenges}', '{"confirm_hours": 48}'::jsonb, true)
  where settings -> 'challenges' is null;
