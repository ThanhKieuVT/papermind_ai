"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Paper, SearchResult, SearchSort } from "@/types/paper";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { Alert, Button, Card, EmptyState, PageHeader, Spinner, inputClass, labelClass } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { useLibrary } from "@/hooks/useLibrary";
import { isDuplicate } from "@/lib/utils/identifiers";
import { PaperBadges, SaveToLibraryButton, SourceLinks, formatAuthors } from "@/components/papers/PaperMeta";
import { IconSearch } from "@/components/ui/icons";
import { CatPeeking, CatReading } from "@/components/ui/illustrations";

const PER_PAGE = 10;

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; result: SearchResult };

export function DiscoverView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [sort, setSort] = useState<SearchSort>((params.get("sort") as SearchSort | null) ?? "relevance");
  const [yearFrom, setYearFrom] = useState(params.get("yearFrom") ?? "");
  const [yearTo, setYearTo] = useState(params.get("yearTo") ?? "");
  const [oaOnly, setOaOnly] = useState(params.get("oa") === "true");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [selected, setSelected] = useState<Paper | null>(null);
  const { entries } = useLibrary();
  const savedPapers = entries.map((e) => e.paper);
  const inLibrary = (p: Paper) => isDuplicate(p, savedPapers);

  const runSearch = useCallback(async (search: URLSearchParams) => {
    if (!search.get("q")) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const result = await apiFetch<SearchResult>(`/api/papers/search?${search.toString()}`);
      setStatus({ kind: "done", result });
    } catch (e) {
      setStatus({ kind: "error", message: errorMessage(e) });
    }
  }, []);

  // The URL is the source of truth for the executed search (shareable, back/forward friendly).
  const paramString = params.toString();
  useEffect(() => {
    void runSearch(new URLSearchParams(paramString));
  }, [paramString, runSearch]);

  const navigate = (page: number) => {
    const next = new URLSearchParams();
    next.set("q", query.trim());
    if (sort !== "relevance") next.set("sort", sort);
    if (yearFrom) next.set("yearFrom", yearFrom);
    if (yearTo) next.set("yearTo", yearTo);
    if (oaOnly) next.set("oa", "true");
    if (page > 1) next.set("page", String(page));
    next.set("perPage", String(PER_PAGE));
    router.push(`${pathname}?${next.toString()}`);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) {
      setStatus({ kind: "error", message: "Enter at least 2 characters to search." });
      return;
    }
    navigate(1);
  };

  const currentPage = Number(params.get("page") ?? "1") || 1;

  return (
    <>
      <PageHeader
        title="Discover Papers"
        description="Search millions of scholarly works indexed by OpenAlex. Results show only metadata reported by OpenAlex — missing fields are left blank, never guessed."
      />
      <Card className="relative mb-8 mt-14">
        <CatPeeking className="pointer-events-none absolute -top-[61px] right-10 h-[72px] w-32" />
        <form onSubmit={onSubmit} className="space-y-4" role="search">
          <div>
            <label htmlFor="q" className={labelClass}>Keywords or title</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"><IconSearch size={18} /></span>
                <input
                  id="q"
                  className={`${inputClass} !py-3 pl-11 text-[15px]`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. vision transformer image classification"
                  maxLength={300}
                />
              </div>
              <Button type="submit" className="!px-6" loading={status.kind === "loading"}>Search</Button>
            </div>
          </div>
          <div className="grid gap-3 border-t border-stone-100 pt-4 dark:border-stone-800 sm:grid-cols-2 md:grid-cols-12">
            <div className="md:col-span-3">
              <label htmlFor="sort" className={labelClass}>Sort by</label>
              <select id="sort" className={inputClass} value={sort} onChange={(e) => setSort(e.target.value as SearchSort)}>
                <option value="relevance">Relevance</option>
                <option value="cited_by_count">Most cited</option>
                <option value="publication_year">Newest</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="yearFrom" className={labelClass}>From year</label>
              <input id="yearFrom" type="number" inputMode="numeric" min={1900} max={2100} placeholder="Any" className={inputClass} value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="yearTo" className={labelClass}>To year</label>
              <input id="yearTo" type="number" inputMode="numeric" min={1900} max={2100} placeholder="Any" className={inputClass} value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
            </div>
            <div className="flex items-end md:col-span-5">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-2.5 text-sm text-stone-700 dark:text-stone-200">
                <input type="checkbox" checked={oaOnly} onChange={(e) => setOaOnly(e.target.checked)} className="h-4 w-4 rounded border-stone-300 accent-brand-600" />
                Open access only
              </label>
            </div>
          </div>
        </form>
      </Card>

      {status.kind === "idle" && (
        <EmptyState title="Search for papers" illustration={<CatReading className="h-28 w-40" />}>
          Enter a topic, title or keywords above to search real academic metadata.
        </EmptyState>
      )}
      {status.kind === "loading" && (
        <div className="space-y-4" aria-busy="true">
          <Spinner label="Searching OpenAlex…" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-stone-200/60 dark:bg-stone-800/60" />
          ))}
        </div>
      )}
      {status.kind === "error" && <Alert tone="error" title="Search failed">{status.message}</Alert>}
      {status.kind === "done" && status.result.papers.length === 0 && (
        <EmptyState title="No papers found" icon={<IconSearch size={20} />}>
          Try different keywords, a wider year range, or turn off the open-access filter.
        </EmptyState>
      )}
      {status.kind === "done" && status.result.papers.length > 0 && (
        <>
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400" aria-live="polite">
            About <span className="font-semibold text-stone-900 dark:text-white">{status.result.total.toLocaleString()}</span> results · page {currentPage}
          </p>
          <ul className="space-y-4">
            {status.result.papers.map((paper) => (
              <li key={paper.id}>
                <Card className="transition hover:border-brand-200 hover:shadow-md dark:hover:border-brand-500/40">
                  <h2 className="text-[17px] font-semibold leading-snug tracking-tight text-stone-900 dark:text-white">
                    <button type="button" className="text-left hover:text-brand-700 dark:hover:text-brand-300" onClick={() => setSelected(paper)}>
                      {paper.title}
                    </button>
                  </h2>
                  <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
                    {formatAuthors(paper.authors)}
                    {paper.venue && <> · <span className="italic text-stone-600 dark:text-stone-300">{paper.venue}</span></>}
                  </p>
                  <div className="mt-3"><PaperBadges paper={paper} /></div>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                    {paper.abstract ?? <span className="italic text-stone-400">No abstract available from OpenAlex.</span>}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4 dark:border-stone-800">
                    <SourceLinks paper={paper} />
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(paper)}>Details</Button>
                      <SaveToLibraryButton paper={paper} saved={inLibrary(paper)} />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
            <Button variant="secondary" disabled={currentPage <= 1} onClick={() => navigate(currentPage - 1)}>← Previous</Button>
            <span className="text-sm text-stone-500 dark:text-stone-400">Page {currentPage}</span>
            <Button
              variant="secondary"
              disabled={currentPage * PER_PAGE >= status.result.total || currentPage >= 50}
              onClick={() => navigate(currentPage + 1)}
            >
              Next →
            </Button>
          </nav>
        </>
      )}

      <Dialog open={selected !== null} onClose={() => setSelected(null)} title={selected?.title ?? "Paper"}>
        {selected && <PaperDetails paper={selected} saved={inLibrary(selected)} />}
      </Dialog>
    </>
  );
}

function PaperDetails({ paper, saved }: { paper: Paper; saved: boolean }) {
  return (
    <div className="space-y-4 text-sm">
      <PaperBadges paper={paper} />
      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2">
        <dt className="font-medium text-stone-500">Authors</dt>
        <dd>{paper.authors.length ? paper.authors.join(", ") : "Not available"}</dd>
        <dt className="font-medium text-stone-500">Year</dt>
        <dd>{paper.year ?? "Not available"}</dd>
        <dt className="font-medium text-stone-500">Venue</dt>
        <dd>{paper.venue ?? "Not available"}</dd>
        <dt className="font-medium text-stone-500">DOI</dt>
        <dd>{paper.doi ?? "Not available"}</dd>
        <dt className="font-medium text-stone-500">Citations</dt>
        <dd>{paper.citationCount?.toLocaleString() ?? "Not available"}</dd>
        <dt className="font-medium text-stone-500">Topics</dt>
        <dd>{paper.concepts.length ? paper.concepts.join(", ") : "Not available"}</dd>
        <dt className="font-medium text-stone-500">OpenAlex</dt>
        <dd>
          {paper.openAlexId ? (
            <a className="text-brand-700 hover:underline dark:text-brand-300" href={`https://openalex.org/works/${paper.openAlexId}`} target="_blank" rel="noopener noreferrer">
              {paper.openAlexId} ↗
            </a>
          ) : "—"}
        </dd>
      </dl>
      <div>
        <h3 className="mb-1 font-semibold">Abstract</h3>
        <p className="leading-relaxed text-stone-700 dark:text-stone-300">
          {paper.abstract ?? <span className="italic text-stone-500">No abstract is available for this work from OpenAlex.</span>}
        </p>
      </div>
      {!paper.pdfUrl && (
        <Alert tone="info">No open-access PDF link is known for this paper. You can still open the publisher page, or upload a PDF you have access to in the PDF Reader.</Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-stone-700">
        <SourceLinks paper={paper} />
        <SaveToLibraryButton paper={paper} size="md" saved={saved} />
      </div>
    </div>
  );
}
