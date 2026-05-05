-- 0006: pending_picks — pozdě zadané tipy (do 10 min po startu) ke schválení Masterem.

create table if not exists pending_picks (
  id            bigserial primary key,
  user_id       uuid       not null references auth.users(id) on delete cascade,
  match_id      bigint     not null references matches(id) on delete cascade,
  home_score    int        not null check (home_score >= 0),
  away_score    int        not null check (away_score >= 0),
  home_score_p1 int                check (home_score_p1 >= 0),
  away_score_p1 int                check (away_score_p1 >= 0),
  status        text       not null default 'pending'
                check (status in ('pending','approved','rejected')),
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid                references auth.users(id),
  check ((home_score_p1 is null) = (away_score_p1 is null))
);

create index if not exists pending_picks_status_idx on pending_picks (status, requested_at desc);
create index if not exists pending_picks_user_idx on pending_picks (user_id);

alter table pending_picks enable row level security;

-- vlastní pending vidím vždy
drop policy if exists "pending_picks: own select" on pending_picks;
create policy "pending_picks: own select"
  on pending_picks for select using (user_id = auth.uid());

-- admin vidí všechno
drop policy if exists "pending_picks: admin select" on pending_picks;
create policy "pending_picks: admin select"
  on pending_picks for select using (is_admin());

-- vložit smí jen tipující, jen pro vlastní user_id, max 10 min po startu, neskončený zápas
drop policy if exists "pending_picks: insert late" on pending_picks;
create policy "pending_picks: insert late"
  on pending_picks for insert
  with check (
    user_id = auth.uid()
    and is_approved()
    and exists (select 1 from profiles where id = auth.uid() and is_player)
    and status = 'pending'
    and exists (
      select 1 from matches m
      where m.id = pending_picks.match_id
        and now() >= m.starts_at
        and now() <= m.starts_at + interval '10 minutes'
        and not m.finalized
    )
  );

-- admin update statusu
drop policy if exists "pending_picks: admin update" on pending_picks;
create policy "pending_picks: admin update"
  on pending_picks for update
  using (is_admin())
  with check (is_admin());

-- funkce pro schválení: zkopíruje do picks (přepíše existující) a označí approved
create or replace function public.approve_pending_pick(p_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  pp record;
begin
  if not is_admin() then
    raise exception 'only admin can approve';
  end if;

  select * into pp from pending_picks where id = p_id and status = 'pending';
  if not found then
    raise exception 'pending pick % not found or not pending', p_id;
  end if;

  insert into picks (user_id, match_id, home_score, away_score, home_score_p1, away_score_p1, submitted_at)
  values (pp.user_id, pp.match_id, pp.home_score, pp.away_score, pp.home_score_p1, pp.away_score_p1, now())
  on conflict (user_id, match_id) do update
    set home_score    = excluded.home_score,
        away_score    = excluded.away_score,
        home_score_p1 = excluded.home_score_p1,
        away_score_p1 = excluded.away_score_p1,
        submitted_at  = excluded.submitted_at;

  update pending_picks
    set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where id = p_id;
end;
$$;

-- funkce pro zamítnutí
create or replace function public.reject_pending_pick(p_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'only admin can reject';
  end if;
  update pending_picks
    set status = 'rejected', decided_at = now(), decided_by = auth.uid()
    where id = p_id and status = 'pending';
end;
$$;

grant execute on function public.approve_pending_pick(bigint) to authenticated;
grant execute on function public.reject_pending_pick(bigint) to authenticated;
