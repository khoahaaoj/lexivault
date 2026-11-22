# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-22

Phase 5 — PWA polish, architecture documentation, security headers, and v1.0.0 production release.

### Added

- Web App Manifest (`public/manifest.json`) with standalone display mode, theme colors, and app shortcuts (`/`, `/review`, `/vault`).
- Custom LexiVault app icons (`public/icons/icon.svg`, `icon-192x192.png`, `icon-512x512.png`, `icon-maskable-512x512.png`, and `apple-touch-icon.png`).
- Next.js `Viewport` and Apple Web App metadata in `app/layout.tsx`.
- Global HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) in `next.config.ts`.
- Branded `app/not-found.tsx` and `app/error.tsx` fallback pages.
- Portfolio-ready `README.md` with Mermaid system architecture diagram, schema/SM-2 overview, screenshots section, and Vercel Free-Tier deployment checklist.

### Changed

- Added mobile PWA touch ergonomics (`touch-action: manipulation`, tap highlight cleanup) and `env(safe-area-inset-bottom)` spacing across the bottom navigation bar and Vault detail sheet.

## [0.4.0] - 2026-11-22

Phase 4 — SM-2 spaced repetition engine, unit tests, interactive Flashcard Review UI, and Vocabulary Vault.

### Added

- Pure TypeScript SM-2 engine (`lib/sm2.ts`) supporting `again (1)`, `hard (2)`, `good (3)`, `easy (4)` ratings, minimum `ease_factor >= 1.3`, input validation, `formatReviewInterval()`, `previewRatingIntervals()`, and `getMasteryStatus()`.
- Comprehensive Vitest unit tests (`lib/sm2.test.ts`, `lib/srs/schemas.test.ts`) covering new cards, consecutive progressions, `Again` lapse resets, ease floor, invalid inputs, Zod request/query schemas, and Vault filtering.
- Authenticated Route Handlers (`app/api/review/route.ts`, `app/api/vault/route.ts`, `app/api/vault/[entryId]/route.ts`) guarded by `requireApiUser()` and scoped to `user_id`.
- Shared responsive navigation shell (`components/layout/app-shell.tsx`, `components/layout/nav-links.tsx`) with active `Lookup` (`/`), `Review` (`/review`), and `Vault` (`/vault`) links across desktop top navbar and mobile bottom bar.
- Shared reusable dictionary detail UI (`components/dictionary/entry-details.tsx`) used across Lookup, Review, and Vault.
- Interactive SM-2 Flip Card Review page (`app/review/page.tsx`, `components/review/review-workspace.tsx`) with progress bar, front-card audio + hidden meanings, `Space` to flip, `1–4` keyboard shortcuts, live interval previews, and session re-queueing for `Again`.
- Vocabulary Vault page (`app/vault/page.tsx`, `components/vault/vault-workspace.tsx`) with summary counters, text search, CEFR (`A1–C2`) & mastery (`New`, `Learning`, `Mastered`) filters, accessible detail modal with SM-2 schedule stats, and 2-step delete confirmation.

### Changed

- Updated default Gemini model to `gemini-3.5-flash-lite` and surfaced HTTP `503`/`504` busy/timeout responses cleanly from `POST /api/lookup` (#4).

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

[Unreleased]: https://github.com/khoahaaoj/lexivault/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/khoahaaoj/lexivault/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/khoahaaoj/lexivault/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/khoahaaoj/lexivault/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/khoahaaoj/lexivault/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/khoahaaoj/lexivault/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/khoahaaoj/lexivault/releases/tag/v0.1.0
