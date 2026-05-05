-- 0005: poslední aktivita hráčů, audit log tipů, admin override pro ne-finalizované zápasy

-- ──────────────────────────────────────────────────────────────────────
-- 1) profiles.last_seen_at — kdy byl uživatel naposledy aktivní
-- ──────────────────────────────────────────────────────────────────────
alter table profiles add column if not exists last_seen_at timestamptz;

-- ──────────────────────────────────────────────────────────────────────
-- 2) picks_audit — historie zadávání/úprav/mazání tipů
-- ──────────────────────────────────────────────────────────────────────
create table if not exists picks_audit (
  id            bigserial primary key,
  user_id       uuid       not null,
  match_id      bigint     not null,
  home_score    int,
  away_score    int,
  home_score_p1 int,
  away_score_p1 int,
  action        text       not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_by    uuid,
  changed_at    timestamptz not null default now()
);

create index if not exists picks_audit_changed_at_idx on picks_audit (changed_at desc);
create index if not exists picks_audit_user_idx       on picks_audit (user_id);
create index if not exists picks_audit_match_idx      on picks_audit (match_id);

create or replace function public.log_pick_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_action text := tg_op;
  v_row record;
begin
  if v_action = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;
  insert into picks_audit
    (user_id, match_id, home_score, away_score, home_score_p1, away_score_p1, action, changed_by)
  values
    (v_row.user_id, v_row.match_id,
     v_row.home_score, v_row.away_score,
     v_row.home_score_p1, v_row.away_score_p1,
     v_action, auth.uid());
  return v_row;
end;
$$;

drop trigger if exists picks_audit_trigger on picks;
create trigger picks_audit_trigger
  after insert or update or delete on picks
  for each row execute function public.log_pick_change();

-- RLS pro picks_audit: čte jen admin
alter table picks_audit enable row level security;
drop policy if exists "picks_audit: admin read" on picks_audit;
create policy "picks_audit: admin read"
  on picks_audit for select using (is_admin());

-- ──────────────────────────────────────────────────────────────────────
-- 3) Admin RLS na picks: editace cizích tipů jen pokud zápas není finalized
--    (sjednocené s pravidlem, že se body přepočítávají při finalizaci)
-- ──────────────────────────────────────────────────────────────────────
drop policy if exists "picks: admin full" on picks;

-- admin si vždy může číst
drop policy if exists "picks: admin select" on picks;
create policy "picks: admin select"
  on picks for select using (is_admin());

-- admin smí vkládat tipy komukoliv, dokud zápas není finalizovaný
drop policy if exists "picks: admin insert if not finalized" on picks;
create policy "picks: admin insert if not finalized"
  on picks for insert
  with check (
    is_admin()
    and exists (
      select 1 from matches m
      where m.id = picks.match_id
        and not m.finalized
    )
  );

-- admin smí měnit tipy komukoliv, dokud zápas není finalizovaný
drop policy if exists "picks: admin update if not finalized" on picks;
create policy "picks: admin update if not finalized"
  on picks for update
  using (
    is_admin()
    and exists (
      select 1 from matches m
      where m.id = picks.match_id
        and not m.finalized
    )
  )
  with check (
    is_admin()
    and exists (
      select 1 from matches m
      where m.id = picks.match_id
        and not m.finalized
    )
  );

-- admin smí mazat tipy, dokud zápas není finalizovaný
drop policy if exists "picks: admin delete if not finalized" on picks;
create policy "picks: admin delete if not finalized"
  on picks for delete
  using (
    is_admin()
    and exists (
      select 1 from matches m
      where m.id = picks.match_id
        and not m.finalized
    )
  );
