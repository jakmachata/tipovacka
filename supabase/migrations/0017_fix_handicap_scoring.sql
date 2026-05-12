-- 0017_fix_handicap_scoring.sql
-- BUG FIX: scoring handicap brala raw pick_diff k určení strany uživatelova tipu,
-- ale měla použít efektivní rozdíl (pick_diff + home_handicap).
--
-- Příklad bugu (Francie vs. Česko, hcp = +3.5, tip 2:5):
--   raw pick_diff = -3 → "tip na hosty" (Česko)
--   effective diff = -3 + 3.5 = +0.5 → ve skutečnosti pokrývá HOME (Francie)
--   Před opravou: uživatel byl vyhodnocen jako "tipoval Česko" — body šly špatně.
--   Po opravě: vyhodnocen jako "tipoval Francie pokrývá".
--
-- Nutné po deploy: znovu zavolat score_match() pro všechny už uzavřené zápasy s hcp,
-- aby se body přepočítaly. Viz druhý SQL statement níže.

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
    -- BUG FIX (iter 117): rozhoduje EFEKTIVNÍ rozdíl pick_diff + home_handicap,
    -- ne raw pick_diff. Příklad: hcp = +3.5, tip 2:5 → effDiff = -3 + 3.5 = +0.5 → tip pokrývá home.
    -- Pokud reálný výsledek také pokrývá home (real_diff + hcp > 0), uživatel vyhrává hcp body.
    if (pick_diff::numeric + m.home_handicap) > 0 then
      hcp_pts := case when (m.home_score - m.away_score)::numeric + m.home_handicap > 0
                      then hcp_base else 0 end;
    elsif (pick_diff::numeric + m.home_handicap) < 0 then
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
$$;;

-- Re-skóre všech finalized zápasů (přepočet bodů podle nové logiky).
do $$
declare
  rec record;
begin
  for rec in select id from public.matches where finalized = true loop
    perform public.score_match(rec.id);
  end loop;
end$$;
