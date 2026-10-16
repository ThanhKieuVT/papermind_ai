# Repository audit

**Date:** 2026-10-16

## Starting point

The brief says to audit an "existing PaperMind AI codebase", but there wasn't one. `~/Desktop` had no PaperMind project, and no other Next.js project with that name turned up. So the project was built from scratch, following the target architecture in the brief.

The local environment had a problem too. The default `node` on `PATH` is **v16.20.2**, and Next.js 15 needs ≥ 18.18. Node **v22.23.1** was already installed through nvm and was used for everything. The repository includes an `.nvmrc` file (`22`).

## Findings and their resolution

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Critical | No codebase existed | New Next.js 15 + TypeScript (strict) + Tailwind project |
| 2 | Critical | System Node 16 can't run Next 15 | Use Node 22 (`nvm use`); `engines.node >= 18.18` |
| 3 | Critical | OpenAlex now charges a **per-IP daily budget** when no API key is sent (verified live: "$0.10/day shared with your IP"). Shared serverless IPs will run out of it. | Added optional `OPENALEX_API_KEY` (free key) and `OPENALEX_MAILTO`. A `429` is shown to the user as a clear rate-limit message. |
| 4 | Major | An AI endpoint left public on a free deployment can be abused | In production, AI stays **disabled** unless `AI_ACCESS_TOKEN` is set (or `AI_ALLOW_PUBLIC=true`). There's also a best-effort rate limit per IP and per instance. |
| 5 | Major | PDF.js worker loading from a CDN is fragile | The worker is copied into `public/` on `postinstall` and served from the same origin |
| 6 | Major | IndexedDB transaction completion could be missed (found by tests) | Completion handlers are attached before awaiting the request; `onversionchange` is handled |
| 7 | Minor | `npm audit` reports a postcss advisory in the copy bundled inside `next@15` | It only runs at build time, on our own CSS, never on user input. The fix requires a breaking upgrade to Next 16. Tracked here. |
| 8 | Minor | OpenAlex metadata is sometimes odd (for example, "Attention Is All You Need" is listed with year 2025 under a new DOI) | Shown exactly as reported. Data is never "corrected" by guessing. |

## Prioritized checklist (all done unless noted)

1. ✅ Foundation: Next.js App Router, strict TS, ESLint flat config, Tailwind, Vitest, Playwright
2. ✅ Discovery: OpenAlex client with zod validation, normalization, dedupe, filters, pagination, details dialog
3. ✅ Library: IndexedDB store, notes, tags, status, filters, Markdown/JSON export, JSON import
4. ✅ PDF reader: self-hosted worker, canvas render, navigation, zoom, per-page extraction, scanned/corrupt detection
5. ✅ AI assistant: Gemini provider abstraction, chunking and retrieval, grounded JSON output, quote verification, coverage disclosure
6. ✅ Comparison: 2–5 papers, complete table, "Not reported"/"Not available", unverified-number flags, Markdown export
7. ✅ Study center: AI, rule-based and manual items with origin labels, quiz scoring, review of wrong answers, progress persistence
8. ✅ Tests, docs, CI workflow
9. ✅ Live Gemini calls verified with a real key (see docs/TESTING.md); retry added for transient 503s.
