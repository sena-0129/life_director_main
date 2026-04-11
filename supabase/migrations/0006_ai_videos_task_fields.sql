alter table public.ai_videos
  add column if not exists ark_task_id text;

alter table public.ai_videos
  add column if not exists status text not null default '';

alter table public.ai_videos
  add column if not exists prompt text not null default '';

alter table public.ai_videos
  add column if not exists script text not null default '';

create index if not exists ai_videos_ark_task_id_idx on public.ai_videos (ark_task_id);

