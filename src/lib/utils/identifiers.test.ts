import { describe, expect, it } from "vitest";
import { dedupePapers, isDuplicate, normalizeDoi, normalizeOpenAlexId } from "@/lib/utils/identifiers";
import { parseSearchParams } from "@/lib/validation/search";
import { paper } from "@/tests/fixtures/paper";

describe("identifier normalization", () => {
  it("normalizes DOIs from URLs and prefixes", () => {
    expect(normalizeDoi("https://doi.org/10.1000/ABC.123")).toBe("10.1000/abc.123");
    expect(normalizeDoi("doi: 10.1000/xyz")).toBe("10.1000/xyz");
    expect(normalizeDoi("not a doi")).toBeNull();
    expect(normalizeDoi(null)).toBeNull();
  });
  it("normalizes OpenAlex ids", () => {
    expect(normalizeOpenAlexId("https://openalex.org/W2741809807")).toBe("W2741809807");
    expect(normalizeOpenAlexId("w12")).toBe("W12");
    expect(normalizeOpenAlexId("A123")).toBeNull();
  });
});

describe("duplicate prevention", () => {
  it("dedupes by DOI, OpenAlex id, and title+year", () => {
    const a = paper({ id: "openalex:W1", openAlexId: "W1", doi: "10.1/x" });
    const sameDoi = paper({ id: "openalex:W2", openAlexId: "W2", doi: "10.1/x", title: "Other" });
    const sameId = paper({ id: "openalex:W1", openAlexId: "W1", title: "Renamed" });
    const sameTitle = paper({ id: "local:abc", source: "local", openAlexId: null, title: "A Sufficiently LONG paper title, for matching!" });
    const different = paper({ id: "openalex:W9", openAlexId: "W9", title: "Completely different work title here" });
    expect(dedupePapers([a, sameDoi, sameId, sameTitle, different]).map((p) => p.id)).toEqual(["openalex:W1", "openalex:W9"]);
  });
  it("does not treat same title with different year as duplicate", () => {
    expect(isDuplicate(paper({ openAlexId: null, year: 2021 }), [paper({ openAlexId: null, year: 2020 })])).toBe(false);
  });
});

describe("search parameter validation", () => {
  it("parses valid params with defaults", () => {
    expect(parseSearchParams(new URLSearchParams("q=graph neural networks"))).toEqual({
      query: "graph neural networks",
      page: 1,
      perPage: 10,
      sort: "relevance",
      yearFrom: null,
      yearTo: null,
      openAccessOnly: false,
    });
  });
  it("rejects too-short queries, bad sorts and inverted year ranges", () => {
    expect(() => parseSearchParams(new URLSearchParams("q=a"))).toThrow(/at least 2/);
    expect(() => parseSearchParams(new URLSearchParams("q=ok&sort=random"))).toThrow();
    expect(() => parseSearchParams(new URLSearchParams("q=ok&yearFrom=2022&yearTo=2020"))).toThrow(/after/);
    expect(() => parseSearchParams(new URLSearchParams(`q=${"x".repeat(301)}`))).toThrow(/too long/);
  });
});
