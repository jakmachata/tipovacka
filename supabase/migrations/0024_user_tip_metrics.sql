-- 0024_user_tip_metrics.sql
-- Per-user agregace tipovacích metrik pro admina:
--   1) avg_hcp_distance  = průměr |pickDiff + home_handicap|, kde pickDiff = p.home_score - p.away_score
--                          (jak daleko je tip v průměru od handicapové linie; nižší = bližší k linii)
--   2) avg_margin_error  = průměr |pickDiff - (m.home_score - m.away_score)| nad finalized zápasy
--                          (jak moc se v průměru pleteš v náskoku)
--   3) avg_goals_error   = průměr |p.home_score - m.home_score| + |p.away_score - m.away_score| nad finalized zápasy
--                          (součet absolutních chyb v gólech pro každý tým)

create or replace view public.user_tip_metrics as
select
  p.user_id,
  avg(abs((p.home_score - p.away_score)::numeric + m.home_handicap)) filter (where m.home_handicap is not null) as avg_hcp_distance,
  avg(abs((p.home_score - p.away_score) - (m.home_score - m.away_score))) filter (where m.finalized and m.home_score is not null) as avg_margin_error,
  avg(abs(p.home_score - m.home_score) + abs(p.away_score - m.away_score)) filter (where m.finalized and m.home_score is not null) as avg_goals_error,
  count(*) filter (where m.finalized) as picks_finalized,
  count(*) as picks_total
from public.picks p
join public.matches m on m.id = p.match_id
group by p.user_id;

grant select on public.user_tip_metrics to authenticated;
