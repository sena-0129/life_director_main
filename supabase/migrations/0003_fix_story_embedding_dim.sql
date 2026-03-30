create extension if not exists vector;

alter table public.stories
  add column if not exists embedding vector(1024);

alter table public.stories
  alter column embedding type vector(1024);

drop index if exists stories_embedding_idx;

create index if not exists stories_embedding_idx
  on public.stories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
