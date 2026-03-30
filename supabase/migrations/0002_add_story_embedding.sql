create extension if not exists vector;

alter table public.stories
  add column if not exists embedding vector(1024);

create index if not exists stories_embedding_idx
  on public.stories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
