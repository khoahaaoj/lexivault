# LexiVault

> A personal **English–Vietnamese dictionary** and **spaced-repetition flashcard** PWA — Cambridge-grade definitions, deep Vietnamese explanations, and SM-2 reviews that sync across desktop and mobile.

[![CI](https://github.com/khoahaaoj/lexivault/actions/workflows/ci.yml/badge.svg)](https://github.com/khoahaaoj/lexivault/actions/workflows/ci.yml)

> [!NOTE]
> 🚧 Work in progress — built in phases. See the [Roadmap](#roadmap).

## Why?

Cambridge Dictionary's English–English entries are excellent, but its English–Vietnamese translations are often shallow. LexiVault combines:

1. **Real pronunciation** — IPA and UK/US audio from the Free Dictionary API (Web Speech API fallback).
2. **AI-enriched entries** — Gemini (server-side only) produces CEFR level, natural Vietnamese explanations, usage nuances, collocations, synonym comparisons, and IELTS-level bilingual examples.
3. **Cache-first lookups** — saved words load instantly with zero redundant API calls.
4. **SM-2 flashcards** — review what you look up, on any device.

## Tech Stack

| Layer      | Choice                                                  |
| ---------- | ------------------------------------------------------- |
| Framework  | Next.js 16 (App Router) · React · TypeScript (`strict`) |
| Styling    | Tailwind CSS v4                                         |
| Validation | Zod                                                     |
| Data/Auth  | Supabase (PostgreSQL + Row Level Security)              |
| AI         | Google Gemini via `@google/genai` (Route Handlers only) |
| Testing    | Vitest                                                  |
| CI / Host  | GitHub Actions · Vercel (free tier)                     |

## Getting Started

**Prerequisites:** Node.js ≥ 22 (see `.nvmrc`), npm, and a free [Supabase](https://supabase.com/) project.

```bash
git clone https://github.com/khoahaaoj/lexivault.git
cd lexivault
npm install
cp .env.example .env.local   # fill in Supabase URL, Publishable key, and ALLOWED_EMAILS
npm run dev                  # http://localhost:3000
```

### Database Migration (Supabase)

Run [`supabase/migrations/001_init.sql`](./supabase/migrations/001_init.sql) once on your Supabase project:

1. Open **Supabase Dashboard → SQL Editor → New query**.
2. Paste the contents of `supabase/migrations/001_init.sql` and click **Run**.
3. Confirm `entries` and `srs_cards` appear under **Table Editor** with RLS enabled.

### Securing a Personal Public Deployment

Because LexiVault calls your server-side Gemini API key, protect your quota with two layers:

1. **Server allowlist (`ALLOWED_EMAILS`)** — set `ALLOWED_EMAILS=you@example.com` in `.env.local` and Vercel Environment Variables. Enforced across sign-up, sign-in, Next.js `proxy.ts`, `/auth/callback`, Server Components, and every `/api/*` route.
2. **Disable public sign-ups** — after creating your account, go to **Supabase Dashboard → Authentication → Sign In / Providers → User Signups** and turn off **Allow new users to sign up**.

## Scripts

| Command                 | Description                           |
| ----------------------- | ------------------------------------- |
| `npm run dev`           | Start the dev server                  |
| `npm run build`         | Production build                      |
| `npm run lint`          | ESLint                                |
| `npm run typecheck`     | Generate route types + `tsc --noEmit` |
| `npm run test`          | Run unit tests once (Vitest)          |
| `npm run test:coverage` | Unit tests with coverage report       |
| `npm run format`        | Format with Prettier                  |
| `npm run check`         | Lint + typecheck + test (same as CI)  |

## Environment Variables

See [`.env.example`](./.env.example). Secrets (`GEMINI_API_KEY`, `ALLOWED_EMAILS`) are **server-only** and validated with Zod at runtime; never prefix them with `NEXT_PUBLIC_`.

## Project Structure

```text
app/                 # Next.js App Router (pages, layouts, actions, route handlers)
  api/               # Authenticated Route Handlers (/api/lookup, /api/entries/save)
  auth/callback/     # Email confirmation / PKCE callback route
  login/             # Email + password sign-in & sign-up UI + Server Actions
components/
  lookup/            # Cambridge-inspired dictionary workspace & entry cards
lib/
  ai/                # Server-only Gemini prompts, schemas & structured enrichment
  audio/             # UK/US .mp3 pronunciation player + Web Speech API fallback
  auth/              # Pure allowlist/redirect helpers, Zod schemas, server DAL
  dictionary/        # Input validation, Free Dictionary parser/fetcher, mappers
  env/               # Zod-validated env: schema (pure), public, server-only
  supabase/          # Browser, Server, and Proxy Supabase SSR clients
types/               # Typed Supabase Database schema definitions
proxy.ts             # Next.js 16 session refresh & route/API guard
supabase/migrations/ # SQL schema + RLS policies
.github/workflows/   # CI pipeline
```

## Roadmap

- [x] **Phase 1** — Scaffold, Git hygiene, CI
- [x] **Phase 2** — Supabase schema (RLS), session proxy, allowlist & email/password auth
- [x] **Phase 3** — Hybrid dictionary engine (`POST /api/lookup`, save to flashcards, audio fallback)
- [ ] **Phase 4** — SM-2 engine, unit tests, flashcard review & Vault
- [ ] **Phase 5** — PWA polish, architecture docs, deployment

## License

MIT
