-- ============================================================================
-- LexiVault — Initial Schema (Phase 2)
-- Tables: public.entries, public.srs_cards
-- Security: Row Level Security (RLS) enforced per-user via auth.uid()
-- ============================================================================

-- 1. Dictionary entries (user-scoped cache of enriched words)
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  word text not null,
  part_of_speech text not null,
  cefr_level text not null,
  ipa_uk text not null default '',
  ipa_us text not null default '',
  audio_uk_url text,
  audio_us_url text,
  definition_en text not null,
  explanation_vi text not null,
  nuance_note_vi text not null default '',
  collocations jsonb not null default '[]'::jsonb,
  synonyms jsonb not null default '[]'::jsonb,
  antonyms jsonb not null default '[]'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),

  constraint entries_word_normalized check (
    word = lower(btrim(word)) and char_length(word) between 1 and 80
  ),
  constraint entries_part_of_speech_non_empty check (
    char_length(btrim(part_of_speech)) between 1 and 40
  ),
  constraint entries_cefr_level_valid check (
    cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  ),
  constraint entries_collocations_is_array check (
    jsonb_typeof(collocations) = 'array'
  ),
  constraint entries_synonyms_is_array check (
    jsonb_typeof(synonyms) = 'array'
  ),
  constraint entries_antonyms_is_array check (
    jsonb_typeof(antonyms) = 'array'
  ),
  constraint entries_examples_is_array check (
    jsonb_typeof(examples) = 'array'
  ),
  constraint entries_user_word_pos_unique unique (user_id, word, part_of_speech)
);

-- Indexes for cache-first lookup, Vault listing, and CEFR filtering
-- Note: entries_user_word_pos_unique already indexes (user_id, word, part_of_speech)
create index idx_entries_user_created_at
  on public.entries (user_id, created_at desc);

create index idx_entries_user_cefr
  on public.entries (user_id, cefr_level);

-- 2. Spaced Repetition flashcards (SM-2 state per saved entry)
create table public.srs_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null,
  ease_factor double precision not null default 2.5,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,

  constraint srs_cards_entry_id_unique unique (entry_id),
  constraint srs_cards_entry_id_fkey
    foreign key (entry_id) references public.entries (id) on delete cascade,
  constraint srs_cards_ease_factor_min check (ease_factor >= 1.3),
  constraint srs_cards_interval_days_non_negative check (interval_days >= 0),
  constraint srs_cards_repetitions_non_negative check (repetitions >= 0)
);

-- Index for querying due flashcards in review order
create index idx_srs_cards_user_next_review
  on public.srs_cards (user_id, next_review_at asc);

-- ============================================================================
-- Row Level Security (RLS)
-- Using `(select auth.uid())` allows Postgres to evaluate auth.uid() once per
-- query (initPlan) instead of once per scanned row.
-- ============================================================================

alter table public.entries enable row level security;
alter table public.srs_cards enable row level security;

-- entries policies
create policy "entries_select_own"
  on public.entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "entries_insert_own"
  on public.entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "entries_update_own"
  on public.entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "entries_delete_own"
  on public.entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- srs_cards policies
-- Insert and update also verify that the referenced entry belongs to the same user.
create policy "srs_cards_select_own"
  on public.srs_cards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "srs_cards_insert_own"
  on public.srs_cards
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.entries e
      where e.id = entry_id
        and e.user_id = (select auth.uid())
    )
  );

create policy "srs_cards_update_own"
  on public.srs_cards
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.entries e
      where e.id = entry_id
        and e.user_id = (select auth.uid())
    )
  );

create policy "srs_cards_delete_own"
  on public.srs_cards
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
