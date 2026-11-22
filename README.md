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
| Framework  | Next.js (App Router) · React · TypeScript (`strict`)    |
| Styling    | Tailwind CSS v4                                         |
| Validation | Zod                                                     |
| Data/Auth  | Supabase (PostgreSQL + Row Level Security)              |
| AI         | Google Gemini via `@google/genai` (Route Handlers only) |
| Testing    | Vitest                                                  |
| CI / Host  | GitHub Actions · Vercel (free tier)                     |

## Getting Started

**Prerequisites:** Node.js ≥ 22 (see `.nvmrc`), npm.

```bash
git clone https://github.com/khoahaaoj/lexivault.git
cd lexivault
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
```

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

See [`.env.example`](./.env.example). Secrets (e.g. `GEMINI_API_KEY`) are **server-only** and validated with Zod at runtime; never prefix them with `NEXT_PUBLIC_`.

## Project Structure

```text
app/                 # Next.js App Router (pages, layouts, route handlers)
lib/                 # Framework-agnostic logic (env, SM-2, parsers, clients)
  env/               # Zod-validated env: schema (pure), public, server-only
supabase/migrations/ # SQL schema + RLS policies
public/              # Static assets, PWA icons
.github/workflows/   # CI pipeline
```

## Roadmap

- [x] **Phase 1** — Scaffold, Git hygiene, CI
- [ ] **Phase 2** — Supabase schema (RLS) & email/password auth
- [ ] **Phase 3** — Hybrid dictionary engine (`POST /api/lookup`)
- [ ] **Phase 4** — SM-2 engine, unit tests, flashcard review & Vault
- [ ] **Phase 5** — PWA polish, architecture docs, deployment

## License

MIT
