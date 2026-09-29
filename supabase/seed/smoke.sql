-- Dev/smoke seed: test admin + 6 seed players (spec §91). Safe to re-run.
-- Admin login: smoke-admin@test.local / smoke-test-2026
do $$
declare
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
end $$;
