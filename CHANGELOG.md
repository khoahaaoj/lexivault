# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-22

Phase 1 — project scaffold, Git hygiene and CI.

### Added

- Next.js 16 (App Router) project with TypeScript `strict` mode and Tailwind CSS v4.
- Zod-validated environment configuration split into a pure schema, a
  browser-safe accessor and a `server-only` accessor for secrets.
- Vitest setup with unit tests for environment parsing.
- Prettier with Tailwind class sorting.
- GitHub Actions CI running format check, lint, typecheck and unit tests.
- `.env.example` template, hardened `.gitignore`, README and MIT license.

[Unreleased]: https://github.com/khoahaaoj/lexivault/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/khoahaaoj/lexivault/releases/tag/v0.1.0
