-- Seed the first club (spec §91)
insert into public.clubs (slug, name, timezone)
values ('tt-club', 'TT Club', 'Asia/Tashkent')
on conflict (slug) do nothing;

-- Bootstrap: promote a user to ADMIN of a club by email.
-- Only callable from SQL editor / service role (revoked from anon/authenticated).
create or replace function public.bootstrap_club_admin(p_club_slug text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_user_id uuid;
begin
  select id into v_club_id from public.clubs where slug = p_club_slug;
  if v_club_id is null then raise exception 'club not found'; end if;
  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then raise exception 'user with email % not found (sign up first)', p_email; end if;

  insert into public.users (id, email) values (v_user_id, p_email)
  on conflict (id) do nothing;

  insert into public.club_memberships (club_id, user_id, role)
  values (v_club_id, v_user_id, 'ADMIN')
  on conflict (club_id, user_id) do update set role = 'ADMIN';

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, after)
  values (v_club_id, null, 'ADMIN_BOOTSTRAPPED', 'club_membership', v_user_id::text,
          jsonb_build_object('email', p_email, 'role', 'ADMIN'));
end $$;
revoke execute on function public.bootstrap_club_admin from public, anon, authenticated;
