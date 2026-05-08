-- Oprava infinite recursion v RLS (0011 obsahovala self-referencing policy na profiles).
-- Řešení: SECURITY DEFINER funkce public.is_admin() obchází RLS check, takže nedochází k rekurzi.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select using (
    is_approved = true
    or auth.uid() = id
    or public.is_admin()
  );

drop policy if exists matches_select_public on public.matches;
create policy matches_select_public on public.matches for select using (true);

drop policy if exists teams_select_public on public.teams;
create policy teams_select_public on public.teams for select using (true);

drop policy if exists picks_select_post_start on public.picks;
create policy picks_select_post_start on public.picks
  for select using (
    auth.uid() = user_id
    or public.is_admin()
    or exists (
      select 1 from public.matches m
      where m.id = picks.match_id and m.starts_at <= now()
    )
  );

drop policy if exists scores_select_public on public.scores;
create policy scores_select_public on public.scores for select using (true);

drop policy if exists pending_picks_select_owner_admin on public.pending_picks;
create policy pending_picks_select_owner_admin on public.pending_picks
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

drop policy if exists trophies_insert_admin on public.trophies;
create policy trophies_insert_admin on public.trophies
  for insert with check (public.is_admin());

drop policy if exists trophies_update_admin on public.trophies;
create policy trophies_update_admin on public.trophies
  for update using (public.is_admin());

drop policy if exists trophies_delete_admin on public.trophies;
create policy trophies_delete_admin on public.trophies
  for delete using (public.is_admin());
