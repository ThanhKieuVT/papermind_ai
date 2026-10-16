import { describe, expect, it, vi } from "vitest";
import fixture from "@/tests/fixtures/openalex-search.json";
import { ApiError } from "@/lib/api/errors";
import {
  buildSearchUrl,
  getOpenAlexWork,
  normalizeSearchResponse,
  normalizeWork,
  openAlexWorkSchema,
  reconstructAbstract,
  searchOpenAlex,
} from "@/lib/api/openalex";
import type { SearchParams } from "@/types/paper";

const params: SearchParams = {
  query: "transformer",
  page: 1,
  perPage: 10,
  sort: "relevance",
  yearFrom: null,
  yearTo: null,
  openAccessOnly: false,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("OpenAlex normalization (recorded real response)", () => {
  const result = normalizeSearchResponse(fixture, 1, 3);

  it("normalizes all records with core metadata", () => {
    expect(result.total).toBe(fixture.meta.count);
    expect(result.papers).toHaveLength(3);
    const first = result.papers[0]!;
    expect(first.id).toBe("openalex:W2903810591");
    expect(first.doi).toBe("10.1609/aaai.v33i01.33015466");
    expect(first.title).toMatch(/^Tied Transformers/);
    expect(first.year).toBe(2019);
    expect(first.venue).toBe("Proceedings of the AAAI Conference on Artificial Intelligence");
    expect(first.authors.length).toBeGreaterThan(0);
    expect(first.citationCount).toBe(60);
    expect(first.abstract?.length).toBeGreaterThan(50);
  });

  it("keeps missing data as null instead of inventing it", () => {
    const noAbstract = result.papers.find((p) => p.openAlexId === "W2911051864")!;
    expect(noAbstract.abstract).toBeNull();
    expect(noAbstract.pdfUrl).toBeNull();
    expect(noAbstract.isOpenAccess).toBe(false);

    const noVenue = result.papers.find((p) => p.openAlexId === "W3185537577")!;
    expect(noVenue.venue).toBeNull();
    expect(noVenue.pdfUrl).toBe("https://aclanthology.org/2021.acl-srw.36.pdf");
  });

  it("skips malformed records without failing the whole page", () => {
    const raw = { meta: { count: 2 }, results: [{ nonsense: true }, fixture.results[0]] };
    expect(normalizeSearchResponse(raw, 1, 10).papers).toHaveLength(1);
  });

  it("deduplicates identical works", () => {
    const raw = { meta: { count: 2 }, results: [fixture.results[0], fixture.results[0]] };
    expect(normalizeSearchResponse(raw, 1, 10).papers).toHaveLength(1);
  });

  it("handles empty result sets", () => {
    expect(normalizeSearchResponse({ meta: { count: 0 }, results: [] }, 1, 10)).toEqual({ papers: [], total: 0, page: 1, perPage: 10 });
  });

  it("throws on an unexpected response shape", () => {
    expect(() => normalizeSearchResponse({ error: "x" }, 1, 10)).toThrow(ApiError);
  });

  it("rejects records without a title or id and unsafe URLs", () => {
    const work = openAlexWorkSchema.parse({ id: "https://openalex.org/W1", display_name: "", primary_location: null });
    expect(normalizeWork(work)).toBeNull();
    const unsafe = openAlexWorkSchema.parse({
      id: "https://openalex.org/W2",
      display_name: "A paper",
      primary_location: { landing_page_url: "javascript:alert(1)", pdf_url: "ftp://x" },
    });
    const paper = normalizeWork(unsafe)!;
    expect(paper.url).toBeNull();
    expect(paper.pdfUrl).toBeNull();
  });
});

describe("reconstructAbstract", () => {
  it("orders words by position", () => {
    expect(reconstructAbstract({ world: [1], hello: [0], again: [3], hello2: [2] })).toBe("hello world hello2 again");
  });
  it("returns null for missing or empty indexes", () => {
    expect(reconstructAbstract(null)).toBeNull();
    expect(reconstructAbstract({})).toBeNull();
  });
});

describe("buildSearchUrl", () => {
  it("encodes filters, sort and credentials", () => {
    const url = buildSearchUrl(
      { ...params, sort: "cited_by_count", yearFrom: 2018, yearTo: 2020, openAccessOnly: true },
      { apiKey: "k", mailto: "a@b.c" },
    );
    expect(url.searchParams.get("search")).toBe("transformer");
    expect(url.searchParams.get("filter")).toBe("publication_year:2018-2020,is_oa:true");
    expect(url.searchParams.get("sort")).toBe("cited_by_count:desc");
    expect(url.searchParams.get("api_key")).toBe("k");
    expect(url.searchParams.get("mailto")).toBe("a@b.c");
  });
  it("supports open-ended year ranges and relevance sort", () => {
    const url = buildSearchUrl({ ...params, yearFrom: 2020 });
    expect(url.searchParams.get("filter")).toBe("publication_year:>2019");
    expect(url.searchParams.has("sort")).toBe(false);
  });
});

describe("searchOpenAlex error handling", () => {
  it("maps HTTP 429 to rate_limited", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    await expect(searchOpenAlex(params, { fetchImpl })).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });
  it("maps network failures to network_error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(searchOpenAlex(params, { fetchImpl })).rejects.toMatchObject({ code: "network_error" });
  });
  it("maps 5xx to upstream_error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(searchOpenAlex(params, { fetchImpl })).rejects.toMatchObject({ code: "upstream_error" });
  });
  it("maps invalid JSON to upstream_error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(searchOpenAlex(params, { fetchImpl })).rejects.toMatchObject({ code: "upstream_error" });
  });
  it("returns normalized results on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(fixture));
    const result = await searchOpenAlex(params, { fetchImpl });
    expect(result.papers).toHaveLength(3);
  });
  it("fetches a single work and rejects invalid ids", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(fixture.results[1]));
    expect((await getOpenAlexWork("W3185537577", { fetchImpl })).openAlexId).toBe("W3185537577");
    await expect(getOpenAlexWork("not-an-id", { fetchImpl })).rejects.toMatchObject({ code: "invalid_input" });
    const notFound = vi.fn().mockResolvedValue(jsonResponse({}, 404));
    await expect(getOpenAlexWork("W1", { fetchImpl: notFound })).rejects.toMatchObject({ code: "not_found" });
  });
});
