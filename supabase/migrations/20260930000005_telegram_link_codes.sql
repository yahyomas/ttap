-- Reverse linking: bot issues a short code, the signed-in user enters it on the website.
-- Complements the web → bot deep link (spec §35: secure confirmation flow, never by username).

create table public.telegram_link_codes (
  code         text primary key,
  telegram_id  bigint not null,
  chat_id      bigint not null,
  username     text,
  first_name   text,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index telegram_link_codes_tg_idx on public.telegram_link_codes(telegram_id);
alter table public.telegram_link_codes enable row level security;  -- no policies: RPC only

-- service role: bot asks for a code for this Telegram user (valid 15 min, replaces previous)
create or replace function public.tg_issue_code(p_telegram_id bigint, p_chat_id bigint, p_username text, p_first_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  perform public._assert_service_role();
  delete from public.telegram_link_codes where telegram_id = p_telegram_id or expires_at < now();
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.telegram_link_codes where code = v_code);
  end loop;
  insert into public.telegram_link_codes (code, telegram_id, chat_id, username, first_name, expires_at)
  values (v_code, p_telegram_id, p_chat_id, p_username, p_first_name, now() + interval '15 minutes');
  return v_code;
end $$;
revoke execute on function public.tg_issue_code(bigint, bigint, text, text) from public, anon, authenticated;

-- authenticated: signed-in user claims the code on the website
create or replace function public.claim_telegram_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.telegram_link_codes%rowtype; v_player public.players%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v from public.telegram_link_codes where code = regexp_replace(p_code, '\D', '', 'g') for update;
  if not found or v.used_at is not null or v.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'code_invalid');
  end if;
  delete from public.telegram_accounts where user_id = auth.uid() or telegram_id = v.telegram_id;
  insert into public.telegram_accounts (user_id, telegram_id, chat_id, username, first_name)
  values (auth.uid(), v.telegram_id, v.chat_id, v.username, v.first_name);
  update public.telegram_link_codes set used_at = now() where code = v.code;
  select * into v_player from public.players where user_id = auth.uid() and deleted_at is null limit 1;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_player.club_id, auth.uid(), 'TELEGRAM_LINKED', 'user', auth.uid()::text, jsonb_build_object('telegram_id', v.telegram_id, 'via', 'code'));
  -- greet in Telegram through the outbox
  if v_player.id is not null then
    perform public._notify(v_player.club_id, v_player.id, 'PLAYER_APPROVED', 'Telegram привязан ✅',
      'Теперь сюда будут приходить вызовы, результаты и новости турниров. Команды: /rating /challenges /tournaments', null, '{}'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'chat_id', v.chat_id);
end $$;
grant execute on function public.claim_telegram_code(text) to authenticated;
