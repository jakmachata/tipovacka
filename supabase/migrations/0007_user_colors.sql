-- 0007: vlastní barvy hráčů (bg + text). Null = použít defaultní hash-based barvu.

alter table profiles add column if not exists bg_color  text;
alter table profiles add column if not exists text_color text;

-- Validace: pokud nastavené, musí to být #rrggbb hex.
-- Volné, žádné check constraint, klient validuje.
