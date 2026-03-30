alter table public.profiles
  add column if not exists owner_key text not null default '';

alter table public.stories
  add column if not exists owner_key text not null default '';

create index if not exists profiles_owner_key_idx on public.profiles (owner_key);
create index if not exists stories_owner_key_idx on public.stories (owner_key);

