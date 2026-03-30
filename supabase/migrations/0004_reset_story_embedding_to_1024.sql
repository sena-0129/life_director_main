create extension if not exists vector;

drop index if exists stories_embedding_idx;

alter table public.stories
  drop column if exists embedding;

alter table public.stories
  add column embedding vector(1024);

create index if not exists stories_embedding_idx
  on public.stories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
