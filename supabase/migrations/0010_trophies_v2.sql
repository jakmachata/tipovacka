-- 0010: trophies v2
-- - Drop year column (vše potřebné je teď v event_name)
-- - Add per-place point columns (zobrazí se v UI v závorce za jménem)

-- Drop the year-sorted index (column je pryč)
drop index if exists public.trophies_year_idx;

-- Drop the year column itself
alter table public.trophies drop column if exists year;

-- Add per-place point columns (volitelné — null = bez bodů)
alter table public.trophies add column if not exists gold_points   int;
alter table public.trophies add column if not exists silver_points int;
alter table public.trophies add column if not exists bronze_points int;
