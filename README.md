# Hokejová tipovačka

Webová tipovačka pro MS v hokeji 2026. Next.js 15 + Supabase.

Tato fáze běží na **datech z Olympiády 2026** (12 dummy účtů + 30 zápasů s výsledky).
Schedule + reálné účty se vymění před startem MS.

## Co umí

- registrace e-mail + heslo (admin musí schválit, než hráč začne tipovat)
- tipování (skóre po 60. min + nepovinně po 1. třetině)
- handicap se počítá automaticky z tvého rozdílu skóre a handicapu domácích
- cizí tipy schované do startu zápasu (vynucené v DB přes RLS)
- bodování:
  - skupina: 3 (Česko) / 1 (ostatní)
  - předkolo + čtvrtfinále: 2
  - semifinále: 3
  - bronz + finále: 4
  - **+4** za přesný výsledek po 60. min
  - **+1** za přesný výsledek po 1. třetině
- leaderboard
- admin:
  - schvalování hráčů + checklist „zaplaceno 300 Kč"
  - ruční zadávání handicapů (tlačítko „Stáhnout odds" zatím no-op)
  - zadávání výsledků (60′ + 1. třetina) + checkbox „finalizovat" → spustí přepočet bodů

## Setup

### 1. Supabase projekt

1. Vytvoř nový projekt na [supabase.com](https://supabase.com).
2. V projektu jdi do **SQL Editor** a postupně spusť tři migrace v pořadí:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_scoring.sql`
   - `supabase/migrations/0003_rls.sql`
3. Potom spusť `supabase/seed.sql` (vytvoří 12 dummy účtů, 30 zápasů, ~360 dummy tipů a finalizuje je).
4. V **Authentication → Providers → Email** vypni „Confirm email" (jinak musí dummy účty potvrdit mail).
5. Z **Project Settings → API** zkopíruj `URL`, `anon key` a `service_role key`.

> Alternativa s Supabase CLI: `supabase init` → `supabase link` → `supabase db push` → `supabase db reset`.

### 2. Lokální dev

```bash
cp .env.example .env.local
# vyplň URL a klíče
npm install
npm run dev
```

Pak otevři <http://localhost:3000>. Přihlaš se jako `jakub@tipovacka.local` / `tipovacka123`
(admin) nebo `fiza@tipovacka.local` / `tipovacka123` (běžný hráč).

### 3. Deploy na Vercel

1. Push repa na GitHub.
2. V Vercelu: **Import Project** → vyber repo.
3. Zkopíruj env proměnné z `.env.local` do **Project Settings → Environment Variables**.
4. Deploy.

## Struktura

```
.
├── app/                       Next.js App Router
│   ├── auth/                  login, register, pending
│   ├── (app)/                 chráněné routy (auth + approved)
│   │   ├── schedule/          rozpis + tipovací UI
│   │   ├── matches/[id]/      detail zápasu
│   │   ├── leaderboard/       tabulka pořadí
│   │   ├── rules/             pravidla
│   │   └── admin/             admin panel (jen pro is_admin)
│   ├── layout.tsx
│   └── page.tsx               redirect podle auth stavu
├── lib/
│   ├── supabase/              klienti (server / browser)
│   └── types.ts               doménové typy
├── middleware.ts              auth gate
└── supabase/
    ├── migrations/
    │   ├── 0001_init.sql      tabulky + auto-profil trigger
    │   ├── 0002_scoring.sql   score_match() + leaderboard view
    │   └── 0003_rls.sql       RLS politiky (klíčové!)
    └── seed.sql               Olympiáda 2026 + dummy účty
```

## Co zbývá doudělat

- [ ] Odds scraper (the-odds-api.com nebo OddsPortal). Dnes pouze ruční zadání.
- [ ] Edit-zápas (přesun, přejmenování) v adminu — teď jen handicapy + výsledky.
- [ ] CSV export dat tipovačky.
- [ ] Pre-MS migrace: vyprázdnit `matches`, `picks`, `scores` a doplnit oficiální rozpis MS 2026.
- [ ] Push notifikace nebo e-mail před startem zápasu (volitelné).

## Bezpečnost

Klíčový princip: **cizí tipy nejsou viditelné nikdy přes API, dokud zápas nezačal.**
Tohle vynucuje RLS politika `picks: others after start` v `0003_rls.sql`. Tj. ani
bug v UI, ani přímé volání REST API neumí cizí tipy odhalit.

`SUPABASE_SERVICE_ROLE_KEY` se nesmí dostat do klienta. V tomto projektu se nepoužívá
v žádné stránce — jen pro budoucí cron joby (odds, mailing) na serverové straně.
