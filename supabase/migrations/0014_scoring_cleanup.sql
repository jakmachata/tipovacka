-- Iter 61: oprava score_match — DELETE proběhne i pro non-finalized matches
-- Bug: dříve early-return při not finalized OR home_score IS NULL nechával stale scores rows.
-- Důsledek: když admin un-finalize zápas nebo nuluje skóre, body za p1/hcp tipy zůstávaly v leaderboardu.

CREATE OR REPLACE FUNCTION public.score_match(p_match_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m record;
  p record;
  hcp_base int;
  pick_diff int;
  real_diff int;
  hcp_pts int;
  exact_pts int;
  p1_pts int;
BEGIN
  SELECT * INTO m FROM matches WHERE id = p_match_id;
  IF m IS NULL THEN
    RAISE EXCEPTION 'match % not found', p_match_id;
  END IF;
  -- VŽDY napřed smazat existující skóre — i kdyby match nebyl scoreable.
  DELETE FROM scores WHERE match_id = p_match_id;
  IF NOT m.finalized OR m.home_score IS NULL OR m.home_handicap IS NULL THEN
    RAISE NOTICE 'match % not scoreable, scores cleared', p_match_id;
    RETURN;
  END IF;
  hcp_base := CASE m.stage
                WHEN 'group'   THEN CASE WHEN m.is_czech THEN 3 ELSE 1 END
                WHEN 'prelim'  THEN 2
                WHEN 'quarter' THEN 2
                WHEN 'semi'    THEN 3
                WHEN 'bronze'  THEN 4
                WHEN 'final'   THEN 4
              END;
  real_diff := m.home_score - m.away_score;
  FOR p IN SELECT * FROM picks WHERE match_id = p_match_id LOOP
    pick_diff := p.home_score - p.away_score;
    IF pick_diff > 0 THEN
      hcp_pts := CASE WHEN (m.home_score - m.away_score)::numeric + m.home_handicap > 0
                      THEN hcp_base ELSE 0 END;
    ELSIF pick_diff < 0 THEN
      hcp_pts := CASE WHEN (m.home_score - m.away_score)::numeric + m.home_handicap < 0
                      THEN hcp_base ELSE 0 END;
    ELSE
      IF m.home_handicap >= 0 THEN
        hcp_pts := CASE WHEN (m.home_score - m.away_score)::numeric + m.home_handicap > 0
                        THEN hcp_base ELSE 0 END;
      ELSE
        hcp_pts := CASE WHEN (m.home_score - m.away_score)::numeric + m.home_handicap < 0
                        THEN hcp_base ELSE 0 END;
      END IF;
    END IF;
    exact_pts := CASE
      WHEN p.home_score = m.home_score AND p.away_score = m.away_score
      THEN 4 ELSE 0 END;
    p1_pts := CASE
      WHEN p.home_score_p1 IS NOT NULL
        AND m.home_score_p1 IS NOT NULL
        AND p.home_score_p1 = m.home_score_p1
        AND p.away_score_p1 = m.away_score_p1
      THEN 1 ELSE 0 END;
    INSERT INTO scores (user_id, match_id, hcp_points, exact_points, p1_points)
      VALUES (p.user_id, p.match_id, hcp_pts, exact_pts, p1_pts);
  END LOOP;
END;
$$;

-- Cleanup: smaž stale score rows pro non-finalized/NULL matches z minulosti.
DELETE FROM scores WHERE match_id IN (
  SELECT id FROM matches WHERE NOT finalized OR home_score IS NULL OR home_handicap IS NULL
);
