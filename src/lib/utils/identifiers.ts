import type { Paper } from "@/types/paper";

/** Normalizes a DOI or DOI URL to a lowercase bare DOI ("10.x/y"), or null. */
export function normalizeDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  return /^10\.\d{4,9}\/\S+$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** Extracts the short OpenAlex work id ("W123") from a URL or id. */
export function normalizeOpenAlexId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /(W\d+)\s*$/i.exec(raw.trim());
  return match?.[1] ? match[1].toUpperCase() : null;
}

function normalizedTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Keys that identify the same work across sources, strongest first. */
export function identityKeys(paper: Paper): string[] {
  const keys: string[] = [];
  if (paper.doi) keys.push(`doi:${paper.doi}`);
  if (paper.openAlexId) keys.push(`openalex:${paper.openAlexId}`);
  const titleKey = normalizedTitleKey(paper.title);
  if (titleKey.length > 20 && paper.year) keys.push(`title:${titleKey}|${paper.year}`);
  return keys;
}

/** Removes duplicates (same DOI, OpenAlex id, or title+year), keeping the first occurrence. */
export function dedupePapers(papers: Paper[]): Paper[] {
  const seen = new Set<string>();
  const result: Paper[] = [];
  for (const paper of papers) {
    const keys = identityKeys(paper);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    result.push(paper);
  }
  return result;
}

/** True when `candidate` refers to the same work as any paper in `existing`. */
export function isDuplicate(candidate: Paper, existing: Paper[]): boolean {
  const keys = new Set(existing.flatMap(identityKeys));
  return identityKeys(candidate).some((k) => keys.has(k));
}
