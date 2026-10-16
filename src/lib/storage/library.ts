import type { LibraryEntry, Paper, ReadingStatus, StoredDocument } from "@/types/paper";
import { isDuplicate } from "@/lib/utils/identifiers";
import { STORES, dbDelete, dbGet, dbGetAll, dbPut } from "@/lib/storage/db";

export const LIBRARY_CHANGED_EVENT = "papermind:library-changed";

function notifyChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LIBRARY_CHANGED_EVENT));
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const entries = await dbGetAll<LibraryEntry>(STORES.library);
  return entries.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export function getEntry(paperId: string): Promise<LibraryEntry | undefined> {
  return dbGet<LibraryEntry>(STORES.library, paperId);
}

export type SaveResult = { status: "saved"; entry: LibraryEntry } | { status: "duplicate"; entry: LibraryEntry };

/** Saves a paper unless the same work (by DOI / OpenAlex id / title+year) is already saved. */
export async function savePaper(paper: Paper, extra: Partial<Pick<LibraryEntry, "documentId" | "tags">> = {}): Promise<SaveResult> {
  const existing = await listLibrary();
  const match = existing.find((e) => e.paper.id === paper.id || isDuplicate(paper, [e.paper]));
  if (match) return { status: "duplicate", entry: match };

  const now = new Date().toISOString();
  const entry: LibraryEntry = {
    paper,
    status: "unread",
    tags: extra.tags ?? [],
    notes: "",
    documentId: extra.documentId ?? null,
    addedAt: now,
    updatedAt: now,
  };
  await dbPut(STORES.library, entry);
  notifyChanged();
  return { status: "saved", entry };
}

export async function updateEntry(
  paperId: string,
  patch: Partial<Pick<LibraryEntry, "status" | "tags" | "notes" | "documentId">>,
): Promise<LibraryEntry> {
  const entry = await getEntry(paperId);
  if (!entry) throw new Error("This paper is no longer in your library.");
  const updated: LibraryEntry = {
    ...entry,
    ...patch,
    tags: patch.tags ? normalizeTags(patch.tags) : entry.tags,
    updatedAt: new Date().toISOString(),
  };
  await dbPut(STORES.library, updated);
  notifyChanged();
  return updated;
}

export async function removePaper(paperId: string): Promise<void> {
  await dbDelete(STORES.library, paperId);
  notifyChanged();
}

export function setStatus(paperId: string, status: ReadingStatus): Promise<LibraryEntry> {
  return updateEntry(paperId, { status });
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out.slice(0, 20);
}

export interface LibraryFilter {
  text: string;
  tag: string | null;
  year: number | null;
  status: ReadingStatus | null;
}

export function filterLibrary(entries: LibraryEntry[], filter: LibraryFilter): LibraryEntry[] {
  const text = filter.text.trim().toLowerCase();
  return entries.filter((e) => {
    if (filter.tag && !e.tags.includes(filter.tag)) return false;
    if (filter.year && e.paper.year !== filter.year) return false;
    if (filter.status && e.status !== filter.status) return false;
    if (!text) return true;
    const haystack = [e.paper.title, e.paper.authors.join(" "), e.paper.venue ?? "", e.notes, e.tags.join(" ")]
      .join(" ")
      .toLowerCase();
    return haystack.includes(text);
  });
}

// ---- Documents (uploaded PDFs) ----

export async function saveDocument(doc: StoredDocument): Promise<void> {
  await dbPut(STORES.documents, doc);
}

export function getDocument(id: string): Promise<StoredDocument | undefined> {
  return dbGet<StoredDocument>(STORES.documents, id);
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const docs = await dbGetAll<StoredDocument>(STORES.documents);
  return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteDocument(id: string): Promise<void> {
  await dbDelete(STORES.documents, id);
}
