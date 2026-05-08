-- Po veřejném schedule potřebujeme, aby anon role uměl číst data potřebná pro
-- vykreslení tipovací matice: profily schválených hráčů, picks pro proběhnuté
-- zápasy, scores, leaderboard. Pre-game picks zůstávají skryté i pro anon
-- (to si zajistí UI přes "visible" logic, plus existující picks_select_post_start
-- policy zajišťuje DB-level ochranu).

-- Profiles: anon smí číst schválené hráče (display_name, bg_color, total atd.).
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select using (
    is_approved = true
    or auth.uid() = id
    or exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin = true)
  );

-- Matches & teams: čtení veřejné.
drop policy if exists matches_select_public on public.matches;
create policy matches_select_public on public.matches for select using (true);

drop policy if exists teams_select_public on public.teams;
create policy teams_select_public on public.teams for select using (true);

-- Picks: viditelné pro vlastníka, pro admina, a pro všechny po startu zápasu.
-- (Anon dostane druhou variantu — po startu zápasu vidí všechny picks.)
drop policy if exists picks_select_post_start on public.picks;
create policy picks_select_post_start on public.picks
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.matches m
      where m.id = picks.match_id and m.starts_at <= now()
    )
  );

-- Scores: veřejné (závisí na finalized matches, ale nemá smysl skrývat).
drop policy if exists scores_select_public on public.scores;
create policy scores_select_public on public.scores for select using (true);

-- Leaderboard view: dědí z scores, není potřeba speciální policy.

-- Pending picks: zůstávají restriktivní — vlastník + admin.
drop policy if exists pending_picks_select_owner_admin on public.pending_picks;
create policy pending_picks_select_owner_admin on public.pending_picks
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
