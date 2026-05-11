-- 0016_favorites.sql
-- Per-user favourite tipsters: persisted across devices.
-- Replaces the previous localStorage-only "tipovacka:favorites" client storage.

alter table public.profiles
  add column if not exists favorites text[] not null default '{}'::text[];
