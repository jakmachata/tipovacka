-- Row-Level Security
-- Klíčové pravidlo: cizí tip je vidět teprve od `matches.starts_at`.
-- Implementováno čistě v DB, takže UI ani API to nemůže omylem porušit.

alter table profiles enable row level security;
alter table teams    enable row level security;
alter table matches  enable row level security;
alter table picks    enable row level security;
alter table scores   enable row level security;

-- ──────────────────────────────────────────────────────────────────────
-- Helper: je aktuální uživatel admin?
-- ──────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select coalesce(
    (select is_admin from profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select coalesce(
    (select is_approved from profiles where id = auth.uid()),
    false
  );
$$;

-- ──────────────────────────────────────────────────────────────────────
-- profiles
--   - každý vidí seznam schválených hráčů (display_name, has_paid),
--   - vlastní profil vidíš vždy,
--   - admin vidí vše a může editovat is_approved/is_admin/has_paid.
-- ──────────────────────────────────────────────────────────────────────
create policy "profiles: read approved"
  on profiles for select
  using (is_approved or id = auth.uid() or is_admin());

create policy "profiles: own update (display_name)"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid()
    -- nelze si přepnout is_admin/is_approved/has_paid sám sobě
    and is_admin   = (select is_admin   from profiles where id = auth.uid())
    and is_approved= (select is_approved from profiles where id = auth.uid())
    and has_paid   = (select has_paid   from profiles where id = auth.uid())
  );

create policy "profiles: admin full"
  on profiles for all
  using (is_admin())
  with check (is_admin());

-- ──────────────────────────────────────────────────────────────────────
-- teams — read pro všechny přihlášené, write jen admin
-- ──────────────────────────────────────────────────────────────────────
create policy "teams: read all auth"
  on teams for select using (auth.role() = 'authenticated');

create policy "teams: admin write"
  on teams for all using (is_admin()) with check (is_admin());

-- ──────────────────────────────────────────────────────────────────────
-- matches — read pro všechny přihlášené, write jen admin
-- ──────────────────────────────────────────────────────────────────────
create policy "matches: read all auth"
  on matches for select using (auth.role() = 'authenticated');

create policy "matches: admin write"
  on matches for all using (is_admin()) with check (is_admin());

-- ──────────────────────────────────────────────────────────────────────
-- picks — KLÍČ celého schématu
--   - vlastní tip vidíš a editujš dokud zápas nezačal
--   - cizí tip vidíš až od starts_at zápasu
--   - admin vidí vše vždy
-- ──────────────────────────────────────────────────────────────────────
create policy "picks: own always"
  on picks for select
  using (user_id = auth.uid() or is_admin());

create policy "picks: others after start"
  on picks for select
  using (
    exists (
      select 1 from matches m
      where m.id = picks.match_id
        and now() >= m.starts_at
    )
  );

create policy "picks: insert own before start"
  on picks for insert
  with check (
    user_id = auth.uid()
    and is_approved()
    and exists (
      select 1 from matches m
      where m.id = picks.match_id
        and now() < m.starts_at
    )
  );

create policy "picks: update own before start"
  on picks for update
  using (
    user_id = auth.uid()
    and is_approved()
    and exists (
      select 1 from matches m
      where m.id = picks.match_id
        and now() < m.starts_at
    )
  )
  with check (user_id = auth.uid());

create policy "picks: admin full"
  on picks for all using (is_admin()) with check (is_admin());

-- ──────────────────────────────────────────────────────────────────────
-- scores — read pro všechny schválené, write jen trigger (security definer)
-- ──────────────────────────────────────────────────────────────────────
create policy "scores: read all auth"
  on scores for select using (auth.role() = 'authenticated');
-- write policies záměrně chybí — scores se plní jen přes score_match() trigger,
-- který běží jako security definer

-- ──────────────────────────────────────────────────────────────────────
-- Leaderboard view — RLS se zdědí z `scores` a `profiles`
-- ──────────────────────────────────────────────────────────────────────
grant select on leaderboard to authenticated;
