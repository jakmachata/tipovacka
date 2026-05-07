-- Trophy room: historie tipovaček. Jména držíme jako text (přezdívky se v čase
-- mohou měnit a hráči odcházet, takže chceme historický záznam).
create table if not exists public.trophies (
  id          bigserial primary key,
  year        int  not null,
  event_name  text not null, -- např. "MS 2024", "Olympiáda 2026"
  gold        text,          -- vítěz
  silver      text,          -- druhé místo
  bronze      text,          -- třetí místo
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists trophies_year_idx on public.trophies (year desc);

-- RLS: čtení veřejné (i pro anonymní), zápis pouze admin.
alter table public.trophies enable row level security;

drop policy if exists trophies_select_all on public.trophies;
create policy trophies_select_all on public.trophies
  for select using (true);

drop policy if exists trophies_insert_admin on public.trophies;
create policy trophies_insert_admin on public.trophies
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists trophies_update_admin on public.trophies;
create policy trophies_update_admin on public.trophies
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists trophies_delete_admin on public.trophies;
create policy trophies_delete_admin on public.trophies
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
