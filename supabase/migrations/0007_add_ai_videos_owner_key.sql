alter table public.ai_videos
  add column if not exists owner_key text not null default '';

create index if not exists ai_videos_owner_key_idx on public.ai_videos (owner_key);

