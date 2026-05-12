-- 0020_match_nullable_drafts.sql
-- Umožní přidávat "draft" zápasy bez data a týmů. Admin si je doplní.

do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.matches'::regclass
    and pg_get_constraintdef(oid) ilike '%home_code <> away_code%'
  limit 1;
  if c is not null then
    execute format('alter table public.matches drop constraint %I', c);
  end if;
end$$;

alter table public.matches alter column starts_at drop not null;
alter table public.matches alter column home_code drop not null;
alter table public.matches alter column away_code drop not null;

alter table public.matches add check (
  home_code is null or away_code is null or home_code <> away_code
);
