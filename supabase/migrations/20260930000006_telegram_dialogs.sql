-- Bot-side login/registration (spec §34 "вход в ключевые сценарии", §46 registration flow)
-- Dialog state lives in the DB so multi-step conversations survive serverless webhook invocations.

create table public.telegram_dialogs (
  telegram_id  bigint primary key,
  flow         text not null,            -- 'register' | 'login'
  step         text not null,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);
alter table public.telegram_dialogs enable row level security;  -- service role only

-- Register a player for an auth user created by the bot, and link the Telegram account — atomically.
create or replace function public.tg_register(
  p_user_id uuid, p_club_slug text,
  p_first_name text, p_last_name text, p_display_name text, p_birth_date date,
  p_gender public.gender, p_playing_hand public.playing_hand, p_rttf_rating integer,
  p_telegram_id bigint, p_chat_id bigint, p_username text, p_tg_first_name text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_club uuid; v_player uuid; v_email text;
begin
  perform public._assert_service_role();
  select id into v_club from public.clubs where slug = p_club_slug;
  if v_club is null then raise exception 'club not found'; end if;
  select email into v_email from auth.users where id = p_user_id;
  insert into public.users (id, email) values (p_user_id, v_email) on conflict (id) do nothing;

  if exists (select 1 from public.players where club_id = v_club and user_id = p_user_id and deleted_at is null) then
    return jsonb_build_object('ok', false, 'error', 'already_registered');
  end if;

  insert into public.club_memberships (club_id, user_id, role) values (v_club, p_user_id, 'PLAYER')
  on conflict (club_id, user_id) do nothing;

  insert into public.players (club_id, user_id, first_name, last_name, display_name, birth_date, gender, playing_hand)
  values (v_club, p_user_id, trim(p_first_name), trim(p_last_name), trim(p_display_name), p_birth_date, p_gender, p_playing_hand)
  returning id into v_player;

  if p_rttf_rating is not null then
    insert into public.player_external_ratings (club_id, player_id, source, rating) values (v_club, v_player, 'RTTF', p_rttf_rating);
  end if;

  delete from public.telegram_accounts where user_id = p_user_id or telegram_id = p_telegram_id;
  insert into public.telegram_accounts (user_id, telegram_id, chat_id, username, first_name)
  values (p_user_id, p_telegram_id, p_chat_id, p_username, p_tg_first_name);

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_club, p_user_id, 'PLAYER_REGISTERED_VIA_TELEGRAM', 'player', v_player::text,
          jsonb_build_object('telegram_id', p_telegram_id));
  return jsonb_build_object('ok', true, 'player_id', v_player);
end $$;
revoke execute on function public.tg_register(uuid, text, text, text, text, date, public.gender, public.playing_hand, integer, bigint, bigint, text, text)
  from public, anon, authenticated;

-- Link an existing (password-verified) user to a Telegram account.
create or replace function public.tg_link_user(p_user_id uuid, p_telegram_id bigint, p_chat_id bigint, p_username text, p_tg_first_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_player public.players%rowtype;
begin
  perform public._assert_service_role();
  insert into public.users (id, email) select id, email from auth.users where id = p_user_id on conflict (id) do nothing;
  delete from public.telegram_accounts where user_id = p_user_id or telegram_id = p_telegram_id;
  insert into public.telegram_accounts (user_id, telegram_id, chat_id, username, first_name)
  values (p_user_id, p_telegram_id, p_chat_id, p_username, p_tg_first_name);
  select * into v_player from public.players where user_id = p_user_id and deleted_at is null limit 1;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_player.club_id, p_user_id, 'TELEGRAM_LINKED', 'user', p_user_id::text, jsonb_build_object('telegram_id', p_telegram_id, 'via', 'bot_login'));
  return jsonb_build_object('ok', true, 'display_name', v_player.display_name, 'status', v_player.status);
end $$;
revoke execute on function public.tg_link_user(uuid, bigint, bigint, text, text) from public, anon, authenticated;
