# Testing

## Commands

```bash
npx tsc --noEmit
npm run lint
npm test                      # Vitest unit + integration tests
npm run build
npx playwright install chromium   # once (or use PW_CHANNEL=chrome to use an installed Chrome)
npm run test:e2e              # builds into .next-e2e (won't clobber a running `next dev`), then Playwright on port 3100
```

## Automated coverage

| Area | File | What is tested |
|---|---|---|
| Paper search normalization | `src/lib/api/openalex.test.ts` | A **recorded real OpenAlex response** (`src/tests/fixtures/openalex-search.json`): metadata mapping, missing abstract/PDF/venue kept as `null`, malformed records skipped, dedupe, empty results, unexpected shapes, unsafe URLs |
| API error handling | same | 429 → `rate_limited`, network failure, 5xx, invalid JSON, 404, invalid ids |
| Metadata and duplicates | `src/lib/utils/identifiers.test.ts` | DOI and OpenAlex id normalization; dedupe by DOI, id and title+year; query validation |
| Library persistence | `src/lib/storage/library.test.ts` | IndexedDB (fake-indexeddb): empty library, save, duplicate prevention, notes/tags/status, persistence across a simulated refresh, documents, study progress, JSON export/import round trip, filters, Markdown export |
| PDF extraction | `src/lib/pdf/extract.test.ts` | **Real PDF.js** on generated PDFs: per-page text and metadata, scanned (no-text) detection, progress, corrupt PDF, non-PDF, empty file, size limit, hyphenation rejoin |
| AI response parsing | `src/lib/ai/ai.test.ts` | Verified quotes, fabricated quotes removed, unknown excerpt ids dropped, `paper` claims downgraded without evidence, code fences, invalid JSON |
| Missing credentials, access control | same | No key → disabled; production without token → disabled; token required, wrong token rejected; the key never appears in the status payload; rate limiting |
| Provider errors | same | Invalid key, quota/429, network error, timeout, MAX_TOKENS truncation, blocked/empty responses, key sent in a header (not the URL) |
| Large paper | same | Partial-coverage selection keeps the relevant page and the opening, stays within budget, and the prompt discloses missing parts |
| API route | same | `/api/ai/analyze` returns 503 without a key, validates input (400, provider not called), returns grounded output with a mocked provider, rejects oversized context |
| Comparison completeness | `src/lib/compare/comparison.test.ts` | Every paper/field is present, "Not reported"/"Not available", unverified numbers flagged, abstract-based label, Markdown export, 2–5 paper limit |
| Venues & deadlines | `src/lib/venues/venues.test.ts` | Timezone parsing (AoE, UTC±hh:mm, PT with DST), normalization of real-shaped ccfddl records (ranks, TBD, unsafe links, unranked), next-deadline selection (abstract vs paper, multi-round), estimates (consistent vs unstable history, already-passed year), filters (status/area/any-rank/text/followed), sorting, grouping, countdown, iCalendar escaping/folding/reminders, Google Calendar URLs |
| Photo gallery | `src/lib/storage/photos.test.ts` | Save, list, caption, delete, persistence across refresh, **IndexedDB v1 → v2 upgrade keeps existing library data**, resize maths, file validation |
| Quiz scoring and study | `src/lib/study/study.test.ts` | Correct, incorrect and unanswered counts; empty quiz; rule-based acronym and definition extraction; MCQ validity; AI study items without grounding discarded |

**Result (2026-10-16, Node 22.23.1):** 9 files, **97 tests passed**.

### End-to-end (`e2e/smoke.spec.ts`, production build, no AI key)

1. All pages render; sidebar navigation works.
2. Empty library state and AI-disabled status are shown.
3. Search results (stubbed with a clearly labelled **test fixture**) → details dialog with a missing abstract → save twice (duplicate) → refresh → library persists → notes and tags persist after refresh → comparison falls back to a metadata-only table.
4. A text PDF is uploaded → the **canvas renders** → page 1 and page 2 text is extracted → zoom → AI tab shows the disabled notice → save to library → refresh reopens it → rule-based study cards are generated from the PDF.
5. Corrupt and non-PDF uploads show clear errors.
8. Venues: CORE A* filter (URL-synced) → live countdown visible → follow → `.ics` download contains the event → details dialog → refresh → "Following (1)" shows the venue.
7. Photo gallery: PNG upload (and a non-image rejected) → caption → refresh → image still decodes → delete.
6. Manual flashcards and quiz questions → flip card → scoring (1/2, 50%) → review only incorrect → the score persists after refresh.

**Result:** **8/8 passed** in Google Chrome (`PW_CHANNEL=chrome`). The bundled Chromium download failed on this machine's network, so the system Chrome was used.

## Manual verification performed

* Live `GET /api/papers/search?q=attention is all you need` against the production build returned real OpenAlex results (3.2M hits; titles, DOIs and abstracts present). An invalid query returned 400, a nonsense query returned an empty list, and `GET /api/papers/W2626778328` returned full metadata.
* `/api/ai/status` and `/api/ai/analyze` without a key returned the disabled state and 503 `ai_disabled`.
* `/pdf.worker.min.mjs` is served from our own origin (200).
* A production build with a dummy `GEMINI_API_KEY` was scanned. The key does not appear in `.next/static` (the client bundles).

## Live Gemini verification (2026-10-16, `gemini-2.5-flash`, free tier)

Run against `npm run dev` with a real `GEMINI_API_KEY`:

* **Q&A (answer present):** status `supported`. Every statement was labelled `paper` with the correct pages (1 and 8). The model returned one quote that was not verbatim; the verifier removed it automatically and kept only the verified quotes.
* **Q&A (answer absent: "How many GPUs…?"):** status `not_supported`, with an explicit note that the excerpts don't cover training resources. Nothing was invented.
* **Compare (2 abstract-only papers):** `abstractBased: true`. Limitations were "Not reported" for both papers, and no numbers were flagged as unverified. The first attempt got an **HTTP 503 (Gemini overloaded)**, so a single automatic retry for fast 500/503 responses was added (unit tested).
* **Study:** 6 flashcards and 5 valid MCQs, 0 discarded.
* **Browser UI:** in the Reader, "Summarize the paper" on an uploaded 2-page PDF rendered sections with "From paper" badges, page links and verified quotes (~5 s).

## UNVERIFIED

**Vercel deployment.** It was not performed, because deploying needs your authorization and account. Follow docs/DEPLOYMENT.md, section 4, to verify.
