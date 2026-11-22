# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-11-22

Phase 3 — Hybrid dictionary engine (`POST /api/lookup`), Free Dictionary grounding, Gemini structured output, and Lookup UI.

### Added

- Server-only Gemini structured dictionary enrichment (`lib/ai/dictionary-prompt.ts`, `lib/ai/dictionary-schema.ts`) using `@google/genai` with `responseSchema`, `temperature: 0.2`, Zod validation, and lazy `getServerEnv()`.
- Lookup input normalization & Zod validation (`lib/dictionary/validation.ts`) enforcing 1–80 character English letters, spaces, hyphens, and apostrophes.
- Free Dictionary API parser & resilient HTTP client (`lib/dictionary/free-dictionary.ts`) extracting verified UK/US `.mp3` URLs and condensing `reference_data` to `word`, IPA `phonetics`, and up to 3 `definitions` per `partOfSpeech` (failing open on 404s for idioms/phrasal verbs).
- Cache-first `POST /api/lookup` and idempotent `POST /api/entries/save` Route Handlers guarded by `requireApiUser()`, preserving existing SM-2 card state on re-save.
- Client pronunciation player (`lib/audio/pronunciation.ts`) preferring real `.mp3` audio with Web Speech API (`en-GB`/`en-US`) fallback.
- Mobile-first Cambridge-inspired Lookup UI (`components/lookup/lookup-workspace.tsx`, `components/lookup/entry-card.tsx`, `app/page.tsx`) with CEFR badges, nuance box, collocations, synonym comparisons, bilingual IELTS examples, `"Did you mean?"` typo recovery, loading double-submit guard, and 1-click Save to Flashcards.
- Unit tests for Gemini schema/client mocking, lookup/save validation, Free Dictionary parser/fetcher, and entry mappers.

## [0.2.1] - 2026-11-22

### Fixed

- Defer `createSupabaseServerClient()` with `await io()` from `next/cache` so `@supabase/auth-js` `Date.now()` token-expiry checks do not trigger Next.js 16 Cache Components / Partial Prefetching `Blocking Route` prerender errors.
- Add `suppressHydrationWarning` on root `<html>` and `<body>` elements in `app/layout.tsx` to tolerate attributes injected by browser extensions prior to hydration.

## [0.2.0] - 2026-11-22

Phase 2 — Supabase schema (RLS), session proxy, access allowlist, and email/password authentication.

### Added

- PostgreSQL migration `supabase/migrations/001_init.sql` creating `entries` and `srs_cards` with normalized constraints, indexes, and strict per-user Row Level Security policies.
- Typed Supabase `Database` schema definitions in `types/database.ts`.
- Browser, Server, and Next.js 16 Proxy (`proxy.ts`) Supabase SSR helpers using `getClaims()` for fast JWT verification/refresh and anti-cache headers on cookie writes.
- Defense-in-depth `ALLOWED_EMAILS` server-only allowlist enforced across sign-up, sign-in, `/auth/callback`, `proxy.ts`, Server Components (`requirePageUser`), and `/api/*` Route Handlers (`requireApiUser`).
- Email + password login/sign-up page (`/login`), Server Actions with Zod validation, email confirmation callback (`/auth/callback`), and authenticated home shell with sign-out.
- Unit tests for `ALLOWED_EMAILS` parsing, allowlist checks, open-redirect sanitization, and auth form schemas.

## [0.1.0] - 2026-11-22

Phase 1 — project scaffold, Git hygiene and CI.

### Added

- Next.js 16 (App Router) project with TypeScript `strict` mode and Tailwind CSS v4.
- Zod-validated environment configuration split into a pure schema, a
  browser-safe accessor and a `server-only` accessor for secrets.
- Vitest setup with unit tests for environment parsing.
- Prettier with Tailwind class sorting.
- GitHub Actions CI running format check, lint, typecheck and test.
- `.env.example` template, hardened `.gitignore`, README and MIT license.

[Unreleased]: https://github.com/khoahaaoj/lexivault/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/khoahaaoj/lexivault/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/khoahaaoj/lexivault/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/khoahaaoj/lexivault/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/khoahaaoj/lexivault/releases/tag/v0.1.0
