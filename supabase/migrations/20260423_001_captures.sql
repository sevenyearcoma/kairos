-- Kairos capture archive with semantic recall
-- Gemini text-embedding-004 outputs 768 dimensions

create extension if not exists vector;

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  content text not null,
  kind text not null check (kind in ('thought', 'task', 'event', 'voice')),
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768)
);

create index if not exists captures_user_created_idx
  on public.captures (user_id, created_at desc);

create index if not exists captures_embedding_idx
  on public.captures
  using hnsw (embedding vector_cosine_ops);

alter table public.captures enable row level security;

drop policy if exists "own_captures_select" on public.captures;
create policy "own_captures_select" on public.captures
  for select using (auth.uid() = user_id);

drop policy if exists "own_captures_insert" on public.captures;
create policy "own_captures_insert" on public.captures
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_captures_update" on public.captures;
create policy "own_captures_update" on public.captures
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_captures_delete" on public.captures;
create policy "own_captures_delete" on public.captures
  for delete using (auth.uid() = user_id);

-- Nearest-neighbour recall, scoped to the caller
create or replace function public.match_captures(
  query_embedding vector(768),
  match_count int default 8,
  similarity_threshold float default 0.35
) returns table (
  id uuid,
  content text,
  kind text,
  created_at timestamptz,
  metadata jsonb,
  similarity float
) language sql stable security invoker as $$
  select
    c.id,
    c.content,
    c.kind,
    c.created_at,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.captures c
  where c.user_id = auth.uid()
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
