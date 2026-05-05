-- Seed: Olympiáda 2026 (data ze stávajícího Sheetu) + 12 dummy účtů
-- Spustí se po migracích. Předpoklad: pgcrypto je k dispozici (Supabase default).
--
-- Heslo pro všechny dummy účty: tipovacka123

create extension if not exists pgcrypto;

-- ──────────────────────────────────────────────────────────────────────
-- Teams
-- ──────────────────────────────────────────────────────────────────────
insert into teams (code, name_cs, flag_emoji) values
  ('CAN', 'Kanada',     '🇨🇦'),
  ('USA', 'USA',         '🇺🇸'),
  ('FIN', 'Finsko',     '🇫🇮'),
  ('SWE', 'Švédsko',    '🇸🇪'),
  ('CZE', 'Česko',      '🇨🇿'),
  ('SUI', 'Švýcarsko',  '🇨🇭'),
  ('GER', 'Německo',    '🇩🇪'),
  ('SVK', 'Slovensko',  '🇸🇰'),
  ('LAT', 'Lotyšsko',   '🇱🇻'),
  ('DEN', 'Dánsko',     '🇩🇰'),
  ('FRA', 'Francie',    '🇫🇷'),
  ('ITA', 'Itálie',     '🇮🇹')
on conflict (code) do nothing;

-- ──────────────────────────────────────────────────────────────────────
-- Matches — 30 zápasů Olympiády 2026 (z Tipovacka.Sheet)
-- starts_at: rok 2026, časové pásmo CET (UTC+1)
-- finalized = false; jednorázově je zapneme po vyplnění tipů
-- ──────────────────────────────────────────────────────────────────────
insert into matches
  (game_no, starts_at, home_code, away_code, home_handicap, stage,
   home_score, away_score, home_score_p1, away_score_p1, finalized)
values
  -- skupinová fáze (18 zápasů)
  ( 1, '2026-02-11 16:40+01', 'SVK','FIN',  2.5, 'group',   4,1, 1,0, false),
  ( 2, '2026-02-11 21:10+01', 'SWE','ITA', -5.5, 'group',   5,2, 2,1, false),
  ( 3, '2026-02-12 12:10+01', 'SUI','FRA', -3.5, 'group',   4,0, 1,0, false),
  ( 4, '2026-02-12 16:40+01', 'CZE','CAN',  2.5, 'group',   0,5, 0,2, false),
  ( 5, '2026-02-12 21:10+01', 'LAT','USA',  3.5, 'group',   1,5, 0,2, false),
  ( 6, '2026-02-12 21:10+01', 'GER','DEN', -1.5, 'group',   3,1, 1,0, false),
  ( 7, '2026-02-13 12:10+01', 'FIN','SWE',  0.5, 'group',   4,1, 2,0, false),
  ( 8, '2026-02-13 12:10+01', 'ITA','SVK',  3.5, 'group',   2,3, 0,1, false),
  ( 9, '2026-02-13 16:40+01', 'FRA','CZE',  3.5, 'group',   3,6, 1,2, false),
  (10, '2026-02-13 21:10+01', 'CAN','SUI', -2.5, 'group',   5,1, 2,0, false),
  (11, '2026-02-14 12:10+01', 'GER','LAT', -1.5, 'group',   3,4, 1,1, false),
  (12, '2026-02-14 12:10+01', 'SWE','SVK', -2.5, 'group',   5,3, 2,1, false),
  (13, '2026-02-14 16:40+01', 'FIN','ITA', -4.5, 'group',  11,0, 4,0, false),
  (14, '2026-02-14 21:10+01', 'USA','DEN', -3.5, 'group',   6,3, 2,1, false),
  (15, '2026-02-15 12:10+01', 'SUI','CZE',  0.5, 'group',   3,3, 1,1, false),
  (16, '2026-02-15 16:40+01', 'CAN','FRA', -5.5, 'group',  10,2, 4,1, false),
  (17, '2026-02-15 19:10+01', 'DEN','LAT', -0.5, 'group',   4,2, 1,1, false),
  (18, '2026-02-15 21:10+01', 'USA','GER', -2.5, 'group',   5,1, 2,0, false),
  -- předkolo (4 zápasy)
  (19, '2026-02-17 12:10+01', 'GER','FRA', -2.5, 'prelim',  5,1, 2,0, false),
  (20, '2026-02-17 12:10+01', 'SUI','ITA', -3.5, 'prelim',  3,0, 1,0, false),
  (21, '2026-02-17 16:40+01', 'CZE','DEN', -2.5, 'prelim',  3,2, 1,1, false),
  (22, '2026-02-17 21:10+01', 'SWE','LAT', -3.5, 'prelim',  5,1, 2,0, false),
  -- čtvrtfinále (4 zápasy)
  (23, '2026-02-18 12:10+01', 'SVK','GER',  0.5, 'quarter', 6,2, 2,1, false),
  (24, '2026-02-18 16:40+01', 'CAN','CZE', -3.5, 'quarter', 3,3, 1,1, false),
  (25, '2026-02-18 18:10+01', 'FIN','SUI', -1.5, 'quarter', 2,2, 1,0, false),
  (26, '2026-02-18 21:10+01', 'USA','SWE', -1.5, 'quarter', 1,1, 0,1, false),
  -- semifinále (2 zápasy)
  (27, '2026-02-20 16:40+01', 'CAN','FIN', -2.5, 'semi',    3,2, 1,1, false),
  (28, '2026-02-20 21:10+01', 'USA','SVK', -2.5, 'semi',    6,2, 2,1, false),
  -- medailové zápasy
  (29, '2026-02-21 20:40+01', 'SVK','FIN',  1.5, 'bronze',  1,6, 0,2, false),
  (30, '2026-02-22 14:10+01', 'CAN','USA', -0.5, 'final',   1,1, 0,0, false);

-- ──────────────────────────────────────────────────────────────────────
-- Dummy účty: 12 hráčů + 1 admin (jakub)
-- Heslo: tipovacka123 (změň po prvním přihlášení nebo v adminu)
-- ──────────────────────────────────────────────────────────────────────
do $$
declare
  v_password text := 'tipovacka123';
  v_users text[] := array[
    'jakub','fiza','misa','moncha','marky','martin',
    'mana','ludek','kubala','zbyna','ancha','kubama','jura'
  ];
  v_display text[] := array[
    'Jakub','Fíža','Míša','Monča','Marky','Martin',
    'Máňa','Luděk','KubaLa','Zbyňa','Anča','KubaMa','Jura'
  ];
  i int;
  v_user_id uuid;
begin
  for i in 1..array_length(v_users, 1) loop
    v_user_id := uuid_generate_v4();

    insert into auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_users[i] || '@tipovacka.local',
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',array['email']),
      jsonb_build_object('display_name', v_display[i]),
      now(), now(), '', ''
    );

    -- profile vytvořil trigger handle_new_user;
    -- nastavíme schválení / admin / paid
    update profiles
       set is_approved = true,
           has_paid = true,
           is_admin = (v_users[i] = 'jakub')
     where id = v_user_id;
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────
-- Dummy tipy: každý hráč náhodný tip na každý zápas.
-- Tipy jsou uložené před matches.starts_at je v minulosti, takže RLS
-- INSERT politika by zabránila přidání po deadline. Proto seedujeme
-- bezpečně přes service role v migraci (RLS se neaplikuje na superuser).
-- ──────────────────────────────────────────────────────────────────────
insert into picks (user_id, match_id, home_score, away_score, home_score_p1, away_score_p1)
select
  p.id,
  m.id,
  floor(random() * 6)::int as home,
  floor(random() * 6)::int as away,
  floor(random() * 3)::int as home_p1,
  floor(random() * 3)::int as away_p1
from profiles p
cross join matches m
where p.is_approved and not p.is_admin
  -- pár záměrných shod, ať leaderboard není všude na nule:
  -- (žádná zvláštní logika; náhoda + 360 tipů zaručí slušné rozložení)
on conflict do nothing;

-- ──────────────────────────────────────────────────────────────────────
-- Finalizace všech zápasů → trigger spustí výpočet bodů
-- ──────────────────────────────────────────────────────────────────────
update matches set finalized = true;
