-- 0018_match_tag.sql
-- Free-form text tag per match (replaces the predefined stage enum in UI).
-- Admin může nastavit libovolný krátký tag (ČF, SF, F, Br., PK, …) nebo nic.
-- Stage zůstává pro scoring engine (multiplier podle fáze), ale display všude
-- bere přímo `tag`.

alter table public.matches
  add column if not exists tag text;

-- Předvyplnit tag ze stávajícího stage (zkratky).
update public.matches set tag = case stage::text
  when 'prelim'  then 'PK'
  when 'quarter' then 'ČF'
  when 'semi'    then 'SF'
  when 'bronze'  then 'Br.'
  when 'final'   then 'F'
  else null  -- group = no tag
end
where tag is null;
