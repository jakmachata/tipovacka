-- Hokejová tipovačka — initial schema
-- Postgres / Supabase. Run via `supabase db push` or paste in SQL editor.

-- ──────────────────────────────────────────────────────────────────────
-- Extensions
-- ──────────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────────────
create type match_stage as enum (
  'group',     -- skupinová fáze
  'prelim',    -- předkolo (kvalifikace do čtvrtfinále)
  'quarter',   -- čtvrtfinále
  'semi',      -- semifinále
  'bronze',    -- o 3. místo
  'final'      -- finále
);

-- ──────────────────────────────────────────────────────────────────────
-- profiles — rozšíření auth.users (vlastník = hráč)
-- ──────────────────────────────────────────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null unique,
  is_approved   boolean not null default false,
  is_admin      boolean not null default false,
  has_paid      boolean not null default false,           -- "checklist v adminu"
  created_at    timestamptz not null default now()
);

create index profiles_is_approved_idx on profiles(is_approved);

-- automatické vytvoření profilu při registraci
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ──────────────────────────────────────────────────────────────────────
-- teams — kódy a názvy zemí
-- ──────────────────────────────────────────────────────────────────────
create table teams (
  code        text primary key,           -- 'CZE', 'FIN', ...
  name_cs     text not null,              -- 'Česko'
  flag_emoji  text                        -- '🇨🇿'
);

-- ──────────────────────────────────────────────────────────────────────
-- matches — rozpis zápasů + výsledky
-- ──────────────────────────────────────────────────────────────────────
create table matches (
  id              bigint generated always as identity primary key,
  game_no         int not null unique,                -- pořadové číslo turnaje
  starts_at       timestamptz not null,
  home_code       text not null references teams(code),
  away_code       text not null references teams(code),
  home_handicap   numeric(3,1),                       -- null = ještě nestaženo
  stage           match_stage not null,
  is_czech        boolean generated always as
                    (home_code = 'CZE' or away_code = 'CZE') stored,
  -- výsledky (null dokud zápas neskončí)
  home_score      int,
  away_score      int,
  home_score_p1   int,                                -- po 1. třetině
  away_score_p1   int,
  finalized       boolean not null default false,     -- spustí přepočet bodů
  updated_at      timestamptz not null default now(),
  check (home_code <> away_code),
  check ((home_score is null) = (away_score is null)),
  check ((home_score_p1 is null) = (away_score_p1 is null))
);

create index matches_starts_at_idx on matches(starts_at);
create index matches_finalized_idx on matches(finalized);

-- ──────────────────────────────────────────────────────────────────────
-- picks — tip hráče na konkrétní zápas
-- ──────────────────────────────────────────────────────────────────────
create table picks (
  user_id          uuid not null references auth.users(id) on delete cascade,
  match_id         bigint not null references matches(id) on delete cascade,
  home_score       int not null check (home_score >= 0),
  away_score       int not null check (away_score >= 0),
  home_score_p1    int check (home_score_p1 >= 0),
  away_score_p1    int check (away_score_p1 >= 0),
  submitted_at     timestamptz not null default now(),
  primary key (user_id, match_id),
  check ((home_score_p1 is null) = (away_score_p1 is null))
);

create index picks_match_id_idx on picks(match_id);

-- ──────────────────────────────────────────────────────────────────────
-- scores — vypočtené body za zápas (cache, plněno triggerem)
-- ──────────────────────────────────────────────────────────────────────
create table scores (
  user_id        uuid not null references auth.users(id) on delete cascade,
  match_id       bigint not null references matches(id) on delete cascade,
  hcp_points     int not null default 0,             -- správný handicap
  exact_points   int not null default 0,             -- přesný výsledek po 60. min (4)
  p1_points      int not null default 0,             -- přesný výsledek po 1. třetině (1)
  total_points   int generated always as
                   (hcp_points + exact_points + p1_points) stored,
  computed_at    timestamptz not null default now(),
  primary key (user_id, match_id)
);

create index scores_total_idx on scores(total_points desc);
