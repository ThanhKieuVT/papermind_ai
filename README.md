# PaperMind AI

PaperMind AI is a research workspace for students, engineers and AI researchers. You can use it to **discover**, **read**, **understand**, **compare** and **study** scientific papers.

It's a working application. Search uses live OpenAlex data. PDFs are rendered and their text extracted in your browser. The AI assistant gives grounded answers that come with page-linked evidence.

## Features

| Module | What works |
|---|---|
| **Discover** | Keyword/title search over OpenAlex; sort (relevance / citations / newest); year and open-access filters; pagination; detail dialog; publisher, DOI and OA-PDF links; save to library with duplicate detection (DOI, OpenAlex id, title+year). Missing metadata is shown as missing. |
| **Library** | IndexedDB persistence; notes; tags; reading status; search and filter by tag, year and status; export to Markdown or JSON; import from JSON |
| **PDF Reader** | Local upload (≤ 50 MB); PDF.js rendering with a self-hosted worker; page navigation; zoom; per-page text extraction with copy; scanned-PDF and corrupt-PDF detection; attach PDFs to library papers |
| **AI Assistant** | Summary, problem, motivation/gap, contributions, methodology, terms, equations, datasets/baselines/metrics, limitations, free-form Q&A. Every statement is labelled *From paper* / *Background* / *Interpretation*. Evidence links to real pages, and quotes are checked against the text. Coverage is disclosed when only part of a long paper was analyzed. |
| **Compare** | 2–5 library papers; a 9-aspect table; each paper's evidence basis (full text / abstract / metadata); "Not reported" / "Not available"; numbers that aren't in the source text are flagged; Markdown export; a metadata-only table when AI is off |
| **Study Center** | AI-generated, rule-based (acronyms and definitions) or manual flashcards and multiple-choice questions, each labelled with how it was made; flip cards; mark known; quiz scoring; review incorrect answers; progress saved locally |
| **Venues & Deadlines** | 377 CS conferences: next abstract/paper deadline with a live countdown in any timezone (converted from AoE/UTC±/PT); **CORE, CCF and THCPL ranks side by side**; acceptance-rate history with sources; grouping by urgency; multi-round venues; rebuttal/notification dates; clearly-labelled estimates for unannounced deadlines; stale-venue warnings; follow venues; `.ics` export with 7-day and 1-day reminders; Google Calendar links; shareable filter URLs; dashboard widget |
| **Photos I Love** | A personal photo gallery stored only in this browser: drag-and-drop upload, auto-orientation, resize, **EXIF/GPS stripped on upload**, captions, lightbox, delete |
| **Settings** | Light/dark theme, AI status, access token, storage usage, export, delete all data |

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 3 · pdfjs-dist 4 · zod · Gemini REST API (no SDK) · IndexedDB · Vitest + fake-indexeddb · Playwright

## Installation and local development

Requirements: **Node.js ≥ 18.18** (22 recommended; see `.nvmrc`).

```bash
cd papermind-ai
nvm use            # or make sure `node -v` is >= 18.18
npm install        # also copies the PDF.js worker into public/
cp .env.example .env.local   # optional: add keys
npm run dev        # http://localhost:3000
```

Without any keys, search, reading, library, comparison (metadata only) and the rule-based and manual study tools all work, and AI features show a "disabled" notice.

## Environment variables

See `.env.example`. All of them are server-side only.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Turns on the AI features |
| `GEMINI_MODEL` | Optional model override (default `gemini-2.5-flash`) |
| `AI_ACCESS_TOKEN` | Token users must enter in Settings. **Required for AI in production builds.** |
| `AI_ALLOW_PUBLIC` | `true` turns on AI in production without a token (not recommended) |
| `OPENALEX_API_KEY` | Free OpenAlex key. Recommended, because keyless use shares a small per-IP daily budget. |
| `OPENALEX_MAILTO` | Optional contact e-mail for OpenAlex |

> In `npm run dev`, AI works with just `GEMINI_API_KEY`. In production (`npm run start` or Vercel), you also need `AI_ACCESS_TOKEN` or `AI_ALLOW_PUBLIC=true`.

## Testing

```bash
npx tsc --noEmit      # type check
npm run lint          # ESLint
npm test              # unit/integration tests (Vitest)
npm run build         # production build
npx playwright install chromium   # once
npm run test:e2e      # builds into .next-e2e, then runs end-to-end smoke tests on port 3100
                      # (set PW_CHANNEL=chrome to use an installed Google Chrome)
```

See [docs/TESTING.md](docs/TESTING.md) for coverage and verification status.

### Updating conference deadlines

Deadlines come from [ccfddl/ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) (MIT License, community-maintained, updated daily). A normalized snapshot is committed at `public/data/venues.json`; the page shows its sync time. To refresh it (needs Node ≥ 22.18):

```bash
npm run sync:venues
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In short: import the repo into Vercel, set `OPENALEX_API_KEY` (plus `GEMINI_API_KEY` and `AI_ACCESS_TOKEN` for AI), and deploy.

## Known limitations

* **Data is stored only in the browser.** The library, notes, PDFs and study progress live in IndexedDB. They are not synced across devices, and clearing site data deletes them. Export JSON to back them up. PDFs are not included in exports.
* **No OCR.** Scanned or image-only PDFs are detected, but their text can't be extracted, so AI falls back to the abstract.
* **Math extraction is imperfect.** PDF text extraction often garbles equations. The AI is told to say so rather than reconstruct them.
* **Retrieval is keyword-based** (BM25-style), not vector RAG. For long papers, only the selected chunks are analyzed, and the UI says which pages were included.
* **The AI rate limit is per instance** and best-effort on serverless. The access token is the main protection against abuse.
* **OpenAlex quirks.** Metadata is shown exactly as OpenAlex reports it, including occasional wrong years or duplicate records. Some records have no abstract.
* **Gemini can be briefly overloaded (HTTP 503).** The app retries once automatically. If that also fails, the user sees a "try again" message.
* **On Gemini's free tier, Google may use the submitted text to improve its products.** Avoid analyzing confidential documents with a free-tier key.
* **Venue data covers computer-science conferences only** (no journals or other fields yet). It is a community dataset: dates can be wrong or outdated, so every card links to the official CFP. Acceptance-rate data exists only for some venues. Unannounced deadlines show an *estimate* from previous editions, never an official date.
* The rule-based study generator only finds acronym definitions and explicit "X is defined as …" sentences, so it may find nothing.

## Documentation

* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
* [docs/AUDIT.md](docs/AUDIT.md)
* [docs/TESTING.md](docs/TESTING.md)
* [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
