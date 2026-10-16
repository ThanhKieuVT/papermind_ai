import type { Paper } from "@/types/paper";

/** Test factory for a normalized paper; override any field. */
export function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: "openalex:W1",
    source: "openalex",
    openAlexId: "W1",
    doi: null,
    title: "A sufficiently long paper title for matching",
    authors: [],
    year: 2020,
    venue: null,
    abstract: null,
    citationCount: null,
    url: null,
    pdfUrl: null,
    isOpenAccess: null,
    concepts: [],
    ...overrides,
  };
}
