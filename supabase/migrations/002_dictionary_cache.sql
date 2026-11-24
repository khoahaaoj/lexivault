-- ============================================================================
-- LexiVault — Global Shared Dictionary Cache (L2 scalable read-through cache)
-- Stores normalized, non-user-specific AI/Free-Dictionary lookup results so
-- repeated lookups across users and sessions return in ~80-150ms without
-- re-invoking AI providers or polluting personal flashcard entries.
-- ============================================================================

create table if not exists public.dictionary_cache (
  term text primary key,
  entries jsonb not null,
  updated_at timestamptz not null default now(),

  constraint dictionary_cache_term_normalized check (
    term = lower(btrim(term)) and char_length(term) between 1 and 80
  ),
  constraint dictionary_cache_entries_is_array check (
    jsonb_typeof(entries) = 'array'
  )
);

alter table public.dictionary_cache enable row level security;

create policy "dictionary_cache_select_authenticated"
  on public.dictionary_cache
  for select
  to authenticated
  using (true);

create policy "dictionary_cache_insert_authenticated"
  on public.dictionary_cache
  for insert
  to authenticated
  with check (true);

create policy "dictionary_cache_update_authenticated"
  on public.dictionary_cache
  for update
  to authenticated
  using (true)
  with check (true);
