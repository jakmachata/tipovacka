-- Trophy room iter 10:
--   * daily_ideal_1 / daily_ideal_2 (numeric) — součet nejvyšších a druhých nejvyšších
--     zisků za zápasy turnaje. Slouží pro výpočet DIR1 / DIR2 v public Trophy roomu.
--   * display_order (int) — ruční pořadí pro řazení turnajů; nové záznamy padají
--     dozadu (default na MAX+1).

alter table public.trophies
  add column if not exists daily_ideal_1 numeric,
  add column if not exists daily_ideal_2 numeric,
  add column if not exists display_order int;

-- Backfill: existující záznamy seřaď podle id (nejstarší = nejvýše).
update public.trophies
set display_order = id
where display_order is null;

-- Default pro budoucí inserty (kdyby někdo vložil bez display_order).
alter table public.trophies
  alter column display_order set default 0;

create index if not exists trophies_display_order_idx
  on public.trophies (display_order);
