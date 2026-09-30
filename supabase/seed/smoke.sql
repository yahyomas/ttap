-- Dev/smoke seed: test admin + 6 seed players (spec §91). Safe to re-run.
-- Logins (password for all: smoke-test-2026):
--   smoke-admin@test.local  — ADMIN (no player profile)
--   smoke-timur@test.local  — player Timur (PROVISIONAL 410)
--   smoke-dima@test.local   — player Dima  (ESTABLISHED 380)
--   smoke-aziz@test.local   — player Aziz  (NEW, no rating)
do $$
declare
  r record;
  v_club uuid := (select id from public.clubs where slug = 'tt-club');
  v_admin uuid := '11111111-1111-4111-8111-111111111111';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated',
          'smoke-admin@test.local', crypt('smoke-test-2026', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_admin, v_admin::text, 'email',
          jsonb_build_object('sub', v_admin::text, 'email', 'smoke-admin@test.local', 'email_verified', true), now(), now(), now())
  on conflict do nothing;
  perform public.bootstrap_club_admin('tt-club', 'smoke-admin@test.local');

  insert into public.players (club_id, first_name, last_name, display_name, playing_hand, status, current_rating, peak_rating, rating_status, tournament_count, approved_at)
  select v_club, n, 'Seed', n, h::public.playing_hand, 'ACTIVE', r, r, s::public.rating_status, c, now()
  from (values
    ('Alex','RIGHT',520,'ESTABLISHED',8), ('Bek','LEFT',495,'ESTABLISHED',7), ('Timur','RIGHT',410,'PROVISIONAL',2),
    ('Dima','RIGHT',380,'ESTABLISHED',6), ('Sasha','LEFT',350,'ESTABLISHED',9), ('Aziz','LEFT',null,'NEW',0)
  ) as v(n, h, r, s, c)
  where not exists (select 1 from public.players p where p.club_id = v_club and p.display_name = v.n and p.last_name = 'Seed');

  -- player accounts linked to three seed players
  for r in select * from (values
    ('22222222-2222-4222-8222-222222222222'::uuid, 'smoke-timur@test.local', 'Timur'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'smoke-dima@test.local',  'Dima'),
    ('44444444-4444-4444-8444-444444444444'::uuid, 'smoke-aziz@test.local',  'Aziz')
  ) as v(id, email, name) loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated', r.email,
            crypt('smoke-test-2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), r.id, r.id::text, 'email', jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true), now(), now(), now())
    on conflict do nothing;
    insert into public.users (id, email) values (r.id, r.email) on conflict (id) do nothing;
    insert into public.club_memberships (club_id, user_id, role) values (v_club, r.id, 'PLAYER') on conflict do nothing;
    update public.players set user_id = r.id where club_id = v_club and display_name = r.name and last_name = 'Seed' and user_id is null;
  end loop;
end $$;
