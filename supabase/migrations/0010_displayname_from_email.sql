-- Při registraci nastavíme display_name = část e-mailu před @ (zkrácená na 12 znaků).
-- Hráč si může jméno později přepsat sám (klikem na svůj sloupec) nebo ho upraví Master.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  default_nick text;
begin
  -- Vezmi část před '@' a ořež na 12 znaků; když se nic nedá vytáhnout, použij "hráč".
  default_nick := substr(split_part(coalesce(new.email, ''), '@', 1), 1, 12);
  if default_nick is null or length(default_nick) = 0 then
    default_nick := 'hráč';
  end if;

  insert into public.profiles (id, display_name, email, is_approved, is_player)
  values (new.id, default_nick, new.email, false, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger by měl být už napojený z 0001_init.sql; pro jistotu re-create.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
