# Architecture

## Overview

```
Browser (client components)                       Next.js server (Vercel functions)
──────────────────────────────                    ─────────────────────────────────
Pages: discover, reader, library,                 /api/papers/search   → OpenAlex
       compare, study, settings                   /api/papers/[id]     → OpenAlex
                                                  /api/ai/status       (no secrets)
PDF.js (worker in /public) ── extract text        /api/ai/analyze  ┐
IndexedDB: library, documents, study              /api/ai/compare  ├→ guard → Gemini
chunking + retrieval (select excerpts) ─ POST ──▶ /api/ai/study    ┘   (server-side key)
```

* **PDFs never leave the browser.** Rendering and text extraction happen on the client. When the user clicks an AI action, only the *selected text excerpts* are sent.
* **Personal data is stored only in the browser** (IndexedDB stores: `library`, `documents`, `study`, `photos`; schema v2). There is no database, no authentication, and no server-side file storage. This keeps everything serverless-compatible.
* **AI credentials stay on the server.** `GEMINI_API_KEY` is read only in route handlers, through `lib/ai/provider.ts`.

## Source layout

| Path | Responsibility |
|---|---|
| `src/types/paper.ts` | Domain types (Paper, LibraryEntry, StoredDocument, search types) |
| `src/lib/api/openalex.ts` | OpenAlex client: URL building, zod validation, normalization, error mapping |
| `src/lib/api/errors.ts` | `ApiError` with user-safe messages; never leaks internals |
| `src/lib/api/client.ts` | Browser fetch helper; attaches the AI access token header |
| `src/lib/validation/` | zod schemas for search params and AI request bodies (size limits) |
| `src/lib/utils/identifiers.ts` | DOI and OpenAlex id normalization; duplicate detection |
| `src/lib/storage/` | IndexedDB wrapper, library/documents/study repositories, JSON import |
| `src/lib/pdf/` | PDF.js loader (client) + pure extraction and validation logic (testable in Node) |
| `src/lib/ai/` | Provider abstraction (Gemini), access guard and rate limit, chunking and retrieval, prompts, response parsing and grounding |
| `src/lib/compare/` | Comparison parsing, completeness, number verification, Markdown export |
| `src/lib/study/` | Quiz scoring, rule-based generator, AI study parsing, types |
| `src/lib/venues/` | Conference dataset types, normalization (timezone → UTC), deadline scheduling/estimates/filters, iCalendar export. Snapshot built by `scripts/sync-venues.ts` into `public/data/venues.json` |
| `src/lib/export/` | Markdown/JSON export helpers |
| `src/components/*` | UI by feature (`papers`, `pdf`, `ai`, `compare`, `study`, `layout`, `ui`) |
| `src/app/*` | Thin route files (pages and API handlers) |

## AI grounding pipeline

1. **Chunk.** `chunkPages` splits extracted text into chunks of at most 1,800 characters. Chunks never cross page boundaries, so every chunk keeps its real page number.
2. **Select.** `selectContext` sends the whole paper if it fits in 60k characters. Otherwise it keeps the opening chunks and adds the best chunks by a BM25-style score, using task-specific hint words. It returns a `coverage` object (pages included, chunks selected out of total, `complete`). The UI always shows this, so a truncated analysis is never presented as a full one.
3. **Prompt.** The prompt contains numbered excerpts (`E1…En`), a description of the available content, and strict rules. The model must return JSON in which every statement is labelled `paper`, `background` or `interpretation`.
4. **Verify (server-side, `parseAnalysis`).**
   * Evidence that cites an excerpt id we never supplied is dropped.
   * A quote is kept only if it appears in that excerpt (case- and whitespace-insensitive). Otherwise the quote is removed.
   * A `paper` statement left with no valid evidence is downgraded to `interpretation`.
   * Page numbers come **only** from our own excerpts, never from the model.
5. **Comparison.** Every paper/field cell is filled: missing values become "Not reported", or "Not available" for metadata-only papers. Numbers in a cell that don't appear in that paper's supplied text are flagged as unverified.
6. **Study.** Items that don't cite a supplied excerpt are discarded, as are MCQs with an invalid answer index or duplicate options. The number of discarded items is reported to the user.

## Security controls

* AI routes: `authorizeAiRequest` checks that a provider is configured. In production it also requires an access token (or the explicit `AI_ALLOW_PUBLIC=true`). It then applies a per-IP rate limit (30 requests per 10 minutes, per instance) and a body limit of 400 KB, before any provider call.
* Input limits: query ≤ 300 characters, question ≤ 2,000, ≤ 60 excerpts, ≤ 60k context characters (90k for comparison), PDF ≤ 50 MB (client side).
* External URLs from OpenAlex are restricted to http(s), so `javascript:` URLs are dropped.
* Security headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
* Errors returned to clients are curated messages. Raw provider and upstream errors are never forwarded, and documents are never logged.
