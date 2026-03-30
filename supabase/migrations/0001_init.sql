create table if not exists public.profiles (
  id text primary key,
  name text not null,
  birth_date text not null,
  birth_place text not null,
  gender text not null,
  occupation text not null,
  cities jsonb not null default '[]'::jsonb,
  avatar text not null,
  bio text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stories (
  id bigserial primary key,
  profile_id text not null references public.profiles(id) on delete cascade,
  title text not null,
  stage text not null,
  year text not null,
  age integer not null,
  emotion text not null,
  tags jsonb not null default '[]'::jsonb,
  content text not null,
  timestamp bigint not null,
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  profile_id text references public.profiles(id) on delete set null,
  original_name text not null,
  mime_type text not null,
  size bigint not null,
  sha256 text not null,
  bucket text not null,
  object_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists uploads_profile_id_idx on public.uploads(profile_id);

create table if not exists public.ai_videos (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  object_path text not null,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;
