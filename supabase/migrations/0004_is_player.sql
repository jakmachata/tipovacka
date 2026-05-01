-- 3-state status pro hráče: Ne (is_approved=false), Netipující (is_approved=true, is_player=false), Tipující (is_approved=true, is_player=true).
alter table profiles add column if not exists is_player boolean not null default true;

-- Admin nemá hráčský sloupec
update profiles set is_player = false where is_admin = true;

-- Přejmenování master účtu Jakub → Master
update profiles set display_name = 'Master' where display_name = 'Jakub';
update auth.users
   set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{display_name}', '"Master"')
 where email = 'jakub@tipovacka.local';

-- RLS: pouze is_player smí vkládat/aktualizovat tipy (netipující jen čtou).
drop policy if exists "picks: insert own before start" on picks;
create policy "picks: insert own before start"
  on picks for insert
  with check (
    user_id = auth.uid()
    and is_approved()
    and exists (select 1 from profiles where id = auth.uid() and is_player)
    and exists (
      select 1 from matches m
      where m.id = picks.match_id
        and now() < m.starts_at
    )
  );

drop policy if exists "picks: update own before start" on picks;
create policy "picks: update own before start"
  on picks for update
  using (
    user_id = auth.uid()
    and is_approved()
    and exists (select 1 from profiles where id = auth.uid() and is_player)
    and exists (
      select 1 from matches m
      where m.id = picks.match_id
        and now() < m.starts_at
    )
  )
  with check (user_id = auth.uid());
