-- 0022_score_on_pick_change.sql
-- Když uživatel vloží nebo upraví svůj tip, automaticky se spočítají body pro daný zápas.
-- Tím se zbavíme bug, kdy pick uložený po výsledku zápasu nedostal záznam ve scores.

create or replace function public.trigger_score_on_pick_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.score_match(NEW.match_id);
  return NEW;
end;
$$;

drop trigger if exists pick_score_trigger on public.picks;
create trigger pick_score_trigger
after insert or update on public.picks
for each row execute function public.trigger_score_on_pick_change();
