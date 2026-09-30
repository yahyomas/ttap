-- Phase 5: Telegram (spec §34, §35, §88)
--  * telegram_accounts: one Telegram ID ↔ one user (unique both ways)
--  * secure linking: web generates a one-time token → deep link t.me/<bot>?start=<token> → bot calls tg_link
--  * bot actions run through tg_act(): service-role RPC that impersonates the linked user for the
--    transaction (sets request.jwt.claims so auth.uid() and every existing RPC/RLS check work unchanged)
--  * tournament/player events now also write to the notifications outbox

create table public.telegram_accounts (
  user_id      uuid primary key references public.users(id) on delete cascade,
  telegram_id  bigint not null unique,
  chat_id      bigint not null,
  username     text,
  first_name   text,
  linked_at    timestamptz not null default now()
);

create table public.telegram_link_tokens (
  token       text primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index telegram_link_tokens_user_idx on public.telegram_link_tokens(user_id);

alter table public.telegram_accounts enable row level security;
alter table public.telegram_link_tokens enable row level security;
create policy telegram_accounts_self on public.telegram_accounts for select using (user_id = auth.uid());
grant select on public.telegram_accounts to authenticated;
-- link tokens: never exposed via API; only RPCs touch them

-- ---------- RPC (authenticated): create a one-time link token (10 min) ----------
create or replace function public.create_telegram_link_token()
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  delete from public.telegram_link_tokens where user_id = auth.uid() and (used_at is not null or expires_at < now());
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.telegram_link_tokens (token, user_id, expires_at)
  values (v_token, auth.uid(), now() + interval '10 minutes');
  return v_token;
end $$;

create or replace function public.unlink_telegram()
returns void language sql security definer set search_path = public as $$
  delete from public.telegram_accounts where user_id = auth.uid();
$$;

-- ---------- service-role RPCs (bot) ----------
create or replace function public._assert_service_role()
returns void language plpgsql stable as $$
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user::text) not in ('service_role', 'postgres') then
    raise exception 'service role required' using errcode = '42501';
  end if;
end $$;

-- Link a Telegram account using a token from the deep link. Returns display name for the greeting.
create or replace function public.tg_link(p_token text, p_telegram_id bigint, p_chat_id bigint, p_username text, p_first_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_t public.telegram_link_tokens%rowtype;
  v_player public.players%rowtype;
begin
  perform public._assert_service_role();
  select * into v_t from public.telegram_link_tokens where token = p_token for update;
  if not found or v_t.used_at is not null or v_t.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'token_invalid');
  end if;
  -- one Telegram account per user and vice versa
  delete from public.telegram_accounts where user_id = v_t.user_id or telegram_id = p_telegram_id;
  insert into public.telegram_accounts (user_id, telegram_id, chat_id, username, first_name)
  values (v_t.user_id, p_telegram_id, p_chat_id, p_username, p_first_name);
  update public.telegram_link_tokens set used_at = now() where token = p_token;
  select * into v_player from public.players where user_id = v_t.user_id and deleted_at is null limit 1;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_player.club_id, v_t.user_id, 'TELEGRAM_LINKED', 'user', v_t.user_id::text, jsonb_build_object('telegram_id', p_telegram_id));
  return jsonb_build_object('ok', true, 'user_id', v_t.user_id, 'display_name', v_player.display_name, 'player_id', v_player.id);
end $$;

-- Run an allow-listed action on behalf of the linked user (spec §57: no separate bot business logic).
create or replace function public.tg_act(p_telegram_id bigint, p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_result jsonb := '{}'::jsonb;
begin
  perform public._assert_service_role();
  select user_id into v_user from public.telegram_accounts where telegram_id = p_telegram_id;
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_linked'); end if;

  -- impersonate for the rest of this transaction (auth.uid() reads request.jwt.claims)
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  case p_action
    when 'respond_challenge' then
      perform public.respond_challenge((p_args ->> 'challenge_id')::uuid, (p_args ->> 'accept')::boolean);
    when 'cancel_challenge' then
      perform public.cancel_challenge((p_args ->> 'challenge_id')::uuid, p_args ->> 'reason');
    when 'register_for_tournament' then
      perform public.register_for_tournament((p_args ->> 'tournament_id')::uuid);
    when 'withdraw_from_tournament' then
      perform public.withdraw_from_tournament((p_args ->> 'tournament_id')::uuid);
    else
      raise exception 'unknown action %', p_action;
  end case;
  return jsonb_build_object('ok', true) || v_result;
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end $$;

revoke execute on function public._assert_service_role() from public, anon, authenticated;
revoke execute on function public.tg_link(text, bigint, bigint, text, text) from public, anon, authenticated;
revoke execute on function public.tg_act(bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_telegram_link_token(), public.unlink_telegram() to authenticated;

-- ---------- notification hooks for tournaments and player lifecycle ----------
-- registration opened → all active players
create or replace function public._notify_tournament_open(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t public.tournaments%rowtype; v_tz text; r record;
begin
  select * into v_t from public.tournaments where id = p_tournament_id;
  select timezone into v_tz from public.clubs where id = v_t.club_id;
  for r in select id from public.players where club_id = v_t.club_id and status = 'ACTIVE' and deleted_at is null and user_id is not null loop
    perform public._notify(v_t.club_id, r.id, 'TOURNAMENT_REGISTRATION_OPEN', 'Открыта регистрация: ' || v_t.name,
      to_char(v_t.starts_at at time zone v_tz, 'DD.MM HH24:MI'), '/tournaments/' || v_t.id,
      jsonb_build_object('tournament_id', v_t.id));
  end loop;
end $$;
revoke execute on function public._notify_tournament_open(uuid) from public, anon, authenticated;

-- bracket locked → each participant: first opponent or bye
create or replace function public._notify_bracket_locked(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t public.tournaments%rowtype; r record; v_body text;
begin
  select * into v_t from public.tournaments where id = p_tournament_id;
  for r in
    select tp.player_id, tp.seed,
           (select case when m.player1_id = tp.player_id then m.player2_id else m.player1_id end
              from public.matches m where m.tournament_id = p_tournament_id and m.round = 1
               and tp.player_id in (m.player1_id, m.player2_id) limit 1) as opp
    from public.tournament_participants tp where tp.tournament_id = p_tournament_id and tp.status = 'REGISTERED'
  loop
    v_body := case when r.opp is null then 'Первый раунд пропускаете (bye)'
                   else 'Первый соперник: ' || (select display_name from public.players where id = r.opp) end;
    perform public._notify(v_t.club_id, r.player_id, 'BRACKET_LOCKED', 'Сетка сформирована: ' || v_t.name,
      'Ваш сид #' || r.seed || '. ' || v_body, '/tournaments/' || v_t.id, jsonb_build_object('tournament_id', v_t.id));
  end loop;
end $$;
revoke execute on function public._notify_bracket_locked(uuid) from public, anon, authenticated;

-- tournament completed → participants with their delta
create or replace function public._notify_tournament_completed(p_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t public.tournaments%rowtype; r record; v_champ text;
begin
  select * into v_t from public.tournaments where id = p_tournament_id;
  select display_name into v_champ from public.players where id = v_t.winner_player_id;
  for r in
    select tp.player_id, coalesce((select sum(rating_delta) from public.rating_transactions rt where rt.tournament_id = p_tournament_id and rt.player_id = tp.player_id), 0) as delta
    from public.tournament_participants tp where tp.tournament_id = p_tournament_id and tp.status = 'REGISTERED'
  loop
    perform public._notify(v_t.club_id, r.player_id, 'TOURNAMENT_COMPLETED', 'Турнир завершён: ' || v_t.name,
      'Чемпион — ' || coalesce(v_champ, '?') || '. Ваш рейтинг: ' || case when r.delta >= 0 then '+' else '' end || round(r.delta),
      '/tournaments/' || v_t.id, jsonb_build_object('tournament_id', v_t.id));
  end loop;
end $$;
revoke execute on function public._notify_tournament_completed(uuid) from public, anon, authenticated;

-- Wire hooks with minimal changes: wrap existing RPCs.
create or replace function public.admin_set_tournament_status(p_tournament_id uuid, p_status public.tournament_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.tournaments%rowtype;
begin
  select * into v_t from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found then raise exception 'tournament not found'; end if;
  if not public.is_club_admin(v_t.club_id) then raise exception 'forbidden' using errcode = '42501'; end if;
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
  if p_status = 'REGISTRATION_OPEN' and v_t.status = 'DRAFT' then
    perform public._notify_tournament_open(p_tournament_id);
  end if;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, before, after)
  values (v_t.club_id, auth.uid(), 'TOURNAMENT_STATUS_CHANGED', 'tournament', p_tournament_id::text,
          jsonb_build_object('status', v_t.status), jsonb_build_object('status', p_status));
end $$;

-- lock/complete: add a trigger-free post-hook by wrapping via triggers on tournaments status change
create or replace function public.on_tournament_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'IN_PROGRESS' and old.status <> 'IN_PROGRESS' then
    perform public._notify_bracket_locked(new.id);
  elsif new.status = 'COMPLETED' and old.status <> 'COMPLETED' then
    perform public._notify_tournament_completed(new.id);
  end if;
  return new;
end $$;
create trigger tournaments_notify after update of status on public.tournaments
  for each row execute function public.on_tournament_status_change();

-- Tournament created directly with REGISTRATION_OPEN (admin insert) → notify too
create or replace function public.on_tournament_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'REGISTRATION_OPEN' then perform public._notify_tournament_open(new.id); end if;
  return new;
end $$;
create trigger tournaments_notify_insert after insert on public.tournaments
  for each row execute function public.on_tournament_insert();

-- tournament match confirmed → both players
create or replace function public.on_match_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_w text; v_l text; v_dw numeric; v_dl numeric; v_next uuid; v_next_opp uuid; v_name text;
begin
  if new.status = 'CONFIRMED' and (old.status is distinct from 'CONFIRMED') and new.match_type = 'TOURNAMENT' then
    select display_name into v_w from public.players where id = new.winner_player_id;
    select display_name into v_l from public.players where id = new.loser_player_id;
    select rating_delta into v_dw from public.rating_transactions where match_id = new.id and player_id = new.winner_player_id order by created_at desc limit 1;
    select rating_delta into v_dl from public.rating_transactions where match_id = new.id and player_id = new.loser_player_id order by created_at desc limit 1;
    perform public._notify(new.club_id, new.winner_player_id, 'TOURNAMENT_MATCH_CONFIRMED',
      'Победа над ' || v_l || ' ' || new.winner_sets || ':' || new.loser_sets,
      case when v_dw is null then 'Без изменения рейтинга' else 'Рейтинг: +' || round(v_dw, 1) end,
      '/tournaments/' || new.tournament_id, jsonb_build_object('match_id', new.id));
    perform public._notify(new.club_id, new.loser_player_id, 'TOURNAMENT_MATCH_CONFIRMED',
      'Поражение от ' || v_w || ' ' || new.loser_sets || ':' || new.winner_sets,
      case when v_dl is null then 'Без изменения рейтинга' else 'Рейтинг: ' || round(v_dl, 1) end,
      '/tournaments/' || new.tournament_id, jsonb_build_object('match_id', new.id));
  end if;
  return new;
end $$;
create trigger matches_notify_confirmed after update of status on public.matches
  for each row execute function public.on_match_confirmed();

-- player approved / external rating verified (Phase 1 RPCs) → notify via triggers
create or replace function public.on_player_approved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ACTIVE' and old.status = 'PENDING' then
    perform public._notify(new.club_id, new.id, 'PLAYER_APPROVED', 'Добро пожаловать в клуб!',
      'Ваш профиль одобрен. Регистрируйтесь на ближайший турнир.', '/', '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger players_notify_approved after update of status on public.players
  for each row execute function public.on_player_approved();

create or replace function public.on_external_rating_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'VERIFIED' and old.status <> 'VERIFIED' then
    perform public._notify(new.club_id, new.player_id, 'EXTERNAL_RATING_VERIFIED', 'Рейтинг ' || new.source || ' подтверждён',
      new.rating::text, '/profile', '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger ext_ratings_notify_verified after update of status on public.player_external_ratings
  for each row execute function public.on_external_rating_verified();

-- ---------- bot read helpers (service role) ----------
create or replace function public.tg_context(p_telegram_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_p public.players%rowtype; v_rank int; v_w int; v_l int; v_club public.clubs%rowtype;
begin
  perform public._assert_service_role();
  select user_id into v_user from public.telegram_accounts where telegram_id = p_telegram_id;
  if v_user is null then return jsonb_build_object('linked', false); end if;
  select * into v_p from public.players where user_id = v_user and deleted_at is null limit 1;
  if v_p.id is null then return jsonb_build_object('linked', true, 'user_id', v_user, 'player', null); end if;
  select * into v_club from public.clubs where id = v_p.club_id;
  select rank into v_rank from public.leaderboard where player_id = v_p.id;
  select wins, losses into v_w, v_l from public.player_match_stats where player_id = v_p.id;
  return jsonb_build_object(
    'linked', true, 'user_id', v_user,
    'club', jsonb_build_object('id', v_club.id, 'name', v_club.name, 'timezone', v_club.timezone),
    'player', jsonb_build_object('id', v_p.id, 'display_name', v_p.display_name, 'status', v_p.status,
      'rating', v_p.current_rating, 'rating_status', v_p.rating_status, 'rank', v_rank,
      'wins', coalesce(v_w, 0), 'losses', coalesce(v_l, 0), 'tournament_count', v_p.tournament_count, 'peak', v_p.peak_rating)
  );
end $$;
revoke execute on function public.tg_context(bigint) from public, anon, authenticated;
