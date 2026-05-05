-- 0008: kopie emailu do profiles, aby ho admin viděl bez nutnosti dotahovat auth.users.

alter table profiles add column if not exists email text;

-- Backfill existujících profilů z auth.users
update profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

-- Update trigger: ukládat email i pro nové uživatele
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    new.email
  );
  return new;
end;
$$;
