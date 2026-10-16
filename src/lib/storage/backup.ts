import { z } from "zod";
import type { LibraryEntry } from "@/types/paper";
import { STORES, dbPut } from "@/lib/storage/db";
import { LIBRARY_CHANGED_EVENT, listLibrary, normalizeTags } from "@/lib/storage/library";
import { isDuplicate } from "@/lib/utils/identifiers";

const paperSchema = z.object({
  id: z.string().min(1).max(300),
  source: z.enum(["openalex", "local"]),
  openAlexId: z.string().nullable(),
  doi: z.string().nullable(),
  title: z.string().min(1).max(1000),
  authors: z.array(z.string()).max(500),
  year: z.number().int().nullable(),
  venue: z.string().nullable(),
  abstract: z.string().nullable(),
  citationCount: z.number().int().nullable(),
  url: z.string().nullable(),
  pdfUrl: z.string().nullable(),
  isOpenAccess: z.boolean().nullable(),
  concepts: z.array(z.string()).default([]),
});

const entrySchema = z.object({
  paper: paperSchema,
  status: z.enum(["unread", "reading", "completed"]).default("unread"),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(50_000).default(""),
  documentId: z.string().nullable().default(null),
  addedAt: z.string(),
  updatedAt: z.string(),
});

/** Imports entries from a JSON export. PDFs are not included in exports, so document links are dropped. */
export async function importLibraryJson(json: string): Promise<{ imported: number; skipped: number }> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const rawEntries = (data as { entries?: unknown })?.entries;
  if (!Array.isArray(rawEntries)) throw new Error("This is not a PaperMind library export.");

  const existing = (await listLibrary()).map((e) => e.paper);
  let imported = 0;
  let skipped = 0;
  for (const raw of rawEntries) {
    const parsed = entrySchema.safeParse(raw);
    if (!parsed.success || isDuplicate(parsed.data.paper, existing) || existing.some((p) => p.id === parsed.data.paper.id)) {
      skipped++;
      continue;
    }
    const entry: LibraryEntry = { ...parsed.data, tags: normalizeTags(parsed.data.tags), documentId: null };
    await dbPut(STORES.library, entry);
    existing.push(entry.paper);
    imported++;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LIBRARY_CHANGED_EVENT));
  return { imported, skipped };
}
