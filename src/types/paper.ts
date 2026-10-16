/** Normalized paper metadata. Fields are `null` when the source did not report them. */
export interface Paper {
  /** Stable internal id, e.g. "openalex:W2741809807" or "local:<uuid>". */
  id: string;
  source: "openalex" | "local";
  openAlexId: string | null;
  doi: string | null;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  citationCount: number | null;
  /** Landing page at the publisher / repository. */
  url: string | null;
  /** Direct open-access PDF link, when known. */
  pdfUrl: string | null;
  isOpenAccess: boolean | null;
  concepts: string[];
}

export type ReadingStatus = "unread" | "reading" | "completed";

export interface LibraryEntry {
  paper: Paper;
  status: ReadingStatus;
  tags: string[];
  notes: string;
  /** Id of an uploaded PDF document stored locally, if one is attached. */
  documentId: string | null;
  addedAt: string;
  updatedAt: string;
}

export interface PageText {
  /** 1-based page number. */
  page: number;
  text: string;
}

/** Text extracted from a locally uploaded PDF. Stored in IndexedDB only. */
export interface StoredDocument {
  id: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: PageText[];
  /** Metadata read from the PDF info dictionary, when present. */
  info: { title: string | null; author: string | null };
  /** True when almost no text could be extracted (likely scanned / image-only). */
  likelyScanned: boolean;
  createdAt: string;
  /** Original PDF bytes, so the document can be re-rendered later. */
  blob: Blob | null;
}

export type SearchSort = "relevance" | "cited_by_count" | "publication_year";

export interface SearchParams {
  query: string;
  page: number;
  perPage: number;
  sort: SearchSort;
  yearFrom: number | null;
  yearTo: number | null;
  openAccessOnly: boolean;
}

export interface SearchResult {
  papers: Paper[];
  total: number;
  page: number;
  perPage: number;
}
