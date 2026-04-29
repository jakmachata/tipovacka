-- Scoring engine
-- Přepočítává body, jakmile admin zaškrtne `matches.finalized = true`.
-- Pravidla:
--   hcp_points     skupina:    Česko 3 / ostatní 1
--                  předkolo:   2 (bez ohledu na národnost)
--                  čtvrtfinále:2
--                  semifinále: 3
--                  medaile:    4
--   exact_points   přesný výsledek po 60. min: +4
--   p1_points      přesný výsledek po 1. třetině: +1

create or replace function public.score_match(p_match_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  m record;
  p record;
  hcp_base int;
  pick_diff int;
  real_diff int;
  hcp_pts int;
  exact_pts int;
  p1_pts int;
begin
  select * into m from matches where id = p_match_id;
  if m is null then
    raise exception 'match % not found', p_match_id;
  end if;
  if not m.finalized or m.home_score is null or m.home_handicap is null then
    raise notice 'match % not ready for scoring (finalized=%, score=%, hcp=%)',
      p_match_id, m.finalized, m.home_score, m.home_handicap;
    return;
  end if;

  -- velikost bodu za hcp podle fáze
  hcp_base := case m.stage
                when 'group'   then case when m.is_czech then 3 else 1 end
                when 'prelim'  then 2
                when 'quarter' then 2
                when 'semi'    then 3
                when 'bronze'  then 4
                when 'final'   then 4
              end;

  real_diff := m.home_score - m.away_score;

  -- vyčistit existující skóre pro tento zápas (idempotentní přepočet)
  delete from scores where match_id = p_match_id;

  for p in select * from picks where match_id = p_match_id loop
    pick_diff := p.home_score - p.away_score;

    -- handicap: pick "vsadil na domácí" pokud jeho rozdíl > 0,
    -- na hosty pokud < 0. Při rovnosti pick je na straně domácích.
    -- Vyhrál handicap, pokud (real_diff + home_handicap) má stejné znaménko
    -- jako tipovaná strana.
    --
    -- Pravidlo z Teams listu:
    --   Tipneš 6:1 (pick favorit FIN -3.5) → potřebuješ FIN aspoň o 4
    --   Tipneš 4:1 (pick underdog AUS +3.5) → AUS výhra nebo prohra max o 3
    -- Tj.:
    --   pick na domácí (pick_diff > 0): vyhrává když real_diff + home_handicap > 0
    --   pick na hosty (pick_diff < 0): vyhrává když real_diff + home_handicap < 0
    --   pick na remízu (pick_diff = 0): bere stranu home_handicap (znaménko hcp určí, na koho jde)
    if pick_diff > 0 then
      hcp_pts := case when (m.home_score - m.away_score)::numeric + m.home_handicap > 0
                      then hcp_base else 0 end;
    elsif pick_diff < 0 then
      hcp_pts := case when (m.home_score - m.away_score)::numeric + m.home_handicap < 0
                      then hcp_base else 0 end;
    else
      -- pick remízy: pojme stranu domácích když hcp je kladný (underdog), jinak hosty
      if m.home_handicap >= 0 then
        hcp_pts := case when (m.home_score - m.away_score)::numeric + m.home_handicap > 0
                        then hcp_base else 0 end;
      else
        hcp_pts := case when (m.home_score - m.away_score)::numeric + m.home_handicap < 0
                        then hcp_base else 0 end;
      end if;
    end if;

    -- přesný výsledek po 60.
    exact_pts := case
      when p.home_score = m.home_score and p.away_score = m.away_score
      then 4 else 0 end;

    -- přesný výsledek po 1. třetině (jen pokud hráč i admin vyplnili)
    p1_pts := case
      when p.home_score_p1 is not null
        and m.home_score_p1 is not null
        and p.home_score_p1 = m.home_score_p1
        and p.away_score_p1 = m.away_score_p1
      then 1 else 0 end;

    insert into scores (user_id, match_id, hcp_points, exact_points, p1_points)
    values (p.user_id, p.match_id, hcp_pts, exact_pts, p1_pts);
  end loop;
end;
$$;

-- trigger: přepočítej, kdykoli se zápas finalizuje (nebo se mění výsledky finalizovaného)
create or replace function public.trg_match_finalize()
returns trigger
language plpgsql
as $$
begin
  if new.finalized then
    perform public.score_match(new.id);
  elsif old.finalized and not new.finalized then
    -- admin "odfinalizoval" — smaž skóre
    delete from scores where match_id = new.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger matches_finalize_trigger
  after update on matches
  for each row
  when (
    old.finalized is distinct from new.finalized
    or old.home_score is distinct from new.home_score
    or old.away_score is distinct from new.away_score
    or old.home_score_p1 is distinct from new.home_score_p1
    or old.away_score_p1 is distinct from new.away_score_p1
    or old.home_handicap is distinct from new.home_handicap
  )
  execute function public.trg_match_finalize();

-- pohled pro leaderboard (sčítá body napříč zápasy)
create or replace view leaderboard as
  select
    p.id as user_id,
    p.display_name,
    coalesce(sum(s.hcp_points), 0) as hcp_total,
    coalesce(sum(s.exact_points), 0) as exact_total,
    coalesce(sum(s.p1_points), 0) as p1_total,
    coalesce(sum(s.total_points), 0) as total
  from profiles p
  left join scores s on s.user_id = p.id
  where p.is_approved
  group by p.id, p.display_name
  order by total desc;
