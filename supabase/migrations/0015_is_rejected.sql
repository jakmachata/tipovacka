-- 0015_is_rejected.sql
-- Add is_rejected flag to profiles for explicitly rejected registrations.
-- Used by the "Hráči a aktivita" admin page to separate accounts in three states:
--   1) approved (is_approved = true)                       -> Hráči
--   2) pending  (is_approved = false, is_rejected = false) -> Neschválení
--   3) rejected (is_approved = false, is_rejected = true)  -> Neschválené účty

alter table public.profiles
  add column if not exists is_rejected boolean not null default false;

-- Speeds up the admin badge count + the rejected-table query.
create index if not exists idx_profiles_unapproved_non_rejected
  on public.profiles (is_approved, is_rejected)
  where is_approved = false;
