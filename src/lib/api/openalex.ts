import { z } from "zod";
import type { Paper, SearchParams, SearchResult } from "@/types/paper";
import { ApiError } from "@/lib/api/errors";
import { dedupePapers, normalizeDoi, normalizeOpenAlexId } from "@/lib/utils/identifiers";

const OPENALEX_BASE = "https://api.openalex.org";
const SELECT_FIELDS = [
  "id",
  "doi",
  "display_name",
  "publication_year",
  "authorships",
  "primary_location",
  "best_oa_location",
  "open_access",
  "cited_by_count",
  "abstract_inverted_index",
  "topics",
].join(",");

const locationSchema = z
  .object({
    landing_page_url: z.string().nullish(),
    pdf_url: z.string().nullish(),
    source: z.object({ display_name: z.string().nullish() }).nullish(),
  })
  .nullish();

export const openAlexWorkSchema = z.object({
  id: z.string(),
  doi: z.string().nullish(),
  display_name: z.string().nullish(),
  title: z.string().nullish(),
  publication_year: z.number().int().nullish(),
  authorships: z
    .array(z.object({ author: z.object({ display_name: z.string().nullish() }).nullish() }))
    .nullish(),
  primary_location: locationSchema,
  best_oa_location: locationSchema,
  open_access: z.object({ is_oa: z.boolean().nullish(), oa_url: z.string().nullish() }).nullish(),
  cited_by_count: z.number().int().nullish(),
  abstract_inverted_index: z.record(z.string(), z.array(z.number().int())).nullish(),
  topics: z.array(z.object({ display_name: z.string() })).nullish(),
});

export type OpenAlexWork = z.infer<typeof openAlexWorkSchema>;

const searchResponseSchema = z.object({
  meta: z.object({ count: z.number().int() }),
  results: z.array(z.unknown()),
});

/** Rebuilds plain text from OpenAlex's inverted-index abstract representation. */
export function reconstructAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const positions: [number, string][] = [];
  for (const [word, idxs] of Object.entries(index)) {
    for (const i of idxs) positions.push([i, word]);
  }
  if (positions.length === 0) return null;
  positions.sort((a, b) => a[0] - b[0]);
  const text = positions.map(([, w]) => w).join(" ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Converts a validated OpenAlex work into our normalized Paper model. Missing data stays null. */
export function normalizeWork(work: OpenAlexWork): Paper | null {
  const openAlexId = normalizeOpenAlexId(work.id);
  const title = (work.display_name ?? work.title ?? "").trim();
  if (!openAlexId || !title) return null;

  const doi = normalizeDoi(work.doi);
  const authors = (work.authorships ?? [])
    .map((a) => a.author?.display_name?.trim())
    .filter((n): n is string => Boolean(n));

  const pdfUrl =
    safeHttpUrl(work.best_oa_location?.pdf_url) ?? safeHttpUrl(work.primary_location?.pdf_url);
  const url =
    safeHttpUrl(work.primary_location?.landing_page_url) ??
    (doi ? `https://doi.org/${doi}` : null) ??
    safeHttpUrl(work.open_access?.oa_url);

  return {
    id: `openalex:${openAlexId}`,
    source: "openalex",
    openAlexId,
    doi,
    title,
    authors,
    year: work.publication_year ?? null,
    venue: work.primary_location?.source?.display_name?.trim() || null,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    citationCount: work.cited_by_count ?? null,
    url,
    pdfUrl,
    isOpenAccess: work.open_access?.is_oa ?? null,
    concepts: (work.topics ?? []).map((t) => t.display_name).slice(0, 5),
  };
}

/** Validates each raw result individually so one malformed record does not fail the whole page. */
export function normalizeSearchResponse(raw: unknown, page: number, perPage: number): SearchResult {
  const parsed = searchResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("upstream_error", "The paper search service returned an unexpected response.");
  }
  const papers: Paper[] = [];
  for (const item of parsed.data.results) {
    const work = openAlexWorkSchema.safeParse(item);
    if (!work.success) continue;
    const paper = normalizeWork(work.data);
    if (paper) papers.push(paper);
  }
  return { papers: dedupePapers(papers), total: parsed.data.meta.count, page, perPage };
}

interface ClientOptions {
  apiKey?: string | undefined;
  mailto?: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function withAuth(url: URL, opts: ClientOptions): URL {
  if (opts.apiKey) url.searchParams.set("api_key", opts.apiKey);
  if (opts.mailto) url.searchParams.set("mailto", opts.mailto);
  return url;
}

export function buildSearchUrl(params: SearchParams, opts: ClientOptions = {}): URL {
  const url = new URL(`${OPENALEX_BASE}/works`);
  url.searchParams.set("search", params.query);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("per-page", String(params.perPage));
  url.searchParams.set("select", SELECT_FIELDS);

  const filters: string[] = [];
  if (params.yearFrom && params.yearTo) filters.push(`publication_year:${params.yearFrom}-${params.yearTo}`);
  else if (params.yearFrom) filters.push(`publication_year:>${params.yearFrom - 1}`);
  else if (params.yearTo) filters.push(`publication_year:<${params.yearTo + 1}`);
  if (params.openAccessOnly) filters.push("is_oa:true");
  if (filters.length) url.searchParams.set("filter", filters.join(","));

  if (params.sort === "cited_by_count") url.searchParams.set("sort", "cited_by_count:desc");
  if (params.sort === "publication_year") url.searchParams.set("sort", "publication_year:desc");
  return withAuth(url, opts);
}

async function fetchJson(url: URL, opts: ClientOptions): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
  } catch {
    throw new ApiError("network_error", "Could not reach the paper search service. Check your connection and try again.");
  }
  if (response.status === 429) {
    throw new ApiError(
      "rate_limited",
      "The paper search service rate limit was reached. Please wait and try again (or configure OPENALEX_API_KEY).",
    );
  }
  if (response.status === 404) throw new ApiError("not_found", "Paper not found.");
  if (!response.ok) {
    throw new ApiError("upstream_error", `The paper search service responded with an error (HTTP ${response.status}).`);
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError("upstream_error", "The paper search service returned invalid data.");
  }
}

export async function searchOpenAlex(params: SearchParams, opts: ClientOptions = {}): Promise<SearchResult> {
  const raw = await fetchJson(buildSearchUrl(params, opts), opts);
  return normalizeSearchResponse(raw, params.page, params.perPage);
}

export async function getOpenAlexWork(openAlexId: string, opts: ClientOptions = {}): Promise<Paper> {
  const id = normalizeOpenAlexId(openAlexId);
  if (!id) throw new ApiError("invalid_input", "Invalid OpenAlex work id.");
  const url = withAuth(new URL(`${OPENALEX_BASE}/works/${id}`), opts);
  url.searchParams.set("select", SELECT_FIELDS);
  const raw = await fetchJson(url, opts);
  const work = openAlexWorkSchema.safeParse(raw);
  const paper = work.success ? normalizeWork(work.data) : null;
  if (!paper) throw new ApiError("upstream_error", "The paper search service returned an unexpected record.");
  return paper;
}

export function openAlexOptionsFromEnv(): ClientOptions {
  return {
    apiKey: process.env.OPENALEX_API_KEY || undefined,
    mailto: process.env.OPENALEX_MAILTO || undefined,
  };
}
