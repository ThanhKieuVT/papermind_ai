import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { DB_NAME, closeDb } from "@/lib/storage/db";
import {
  filterLibrary,
  getDocument,
  listLibrary,
  removePaper,
  saveDocument,
  savePaper,
  updateEntry,
} from "@/lib/storage/library";
import { importLibraryJson } from "@/lib/storage/backup";
import { emptyDeck, getDeck, saveDeck } from "@/lib/storage/study";
import { libraryToJson, libraryToMarkdown } from "@/lib/export/markdown";
import { paper } from "@/tests/fixtures/paper";

async function freshDb() {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

/** Simulates a page refresh: drop the cached connection and reopen from storage. */
async function simulateRefresh() {
  await closeDb();
}

describe("library persistence (IndexedDB)", () => {
  beforeEach(freshDb);

  it("starts empty", async () => {
    expect(await listLibrary()).toEqual([]);
  });

  it("saves papers, prevents duplicates, and survives a refresh", async () => {
    const p = paper({ doi: "10.1/x" });
    expect((await savePaper(p)).status).toBe("saved");
    expect((await savePaper(paper({ id: "openalex:W77", openAlexId: "W77", doi: "10.1/x" }))).status).toBe("duplicate");
    await simulateRefresh();
    const entries = await listLibrary();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe("unread");
  });

  it("updates notes, tags and status, and removes papers", async () => {
    await savePaper(paper());
    await updateEntry("openalex:W1", { notes: "Key idea: attention", tags: [" NLP ", "nlp", "Deep Learning"], status: "reading" });
    await simulateRefresh();
    const [entry] = await listLibrary();
    expect(entry?.notes).toBe("Key idea: attention");
    expect(entry?.tags).toEqual(["nlp", "deep-learning"]);
    expect(entry?.status).toBe("reading");
    await removePaper("openalex:W1");
    expect(await listLibrary()).toEqual([]);
    await expect(updateEntry("openalex:W1", { notes: "x" })).rejects.toThrow(/no longer/);
  });

  it("stores extracted documents", async () => {
    await saveDocument({
      id: "d1",
      fileName: "a.pdf",
      fileSize: 10,
      pageCount: 1,
      pages: [{ page: 1, text: "hello" }],
      info: { title: null, author: null },
      likelyScanned: false,
      createdAt: new Date().toISOString(),
      blob: null,
    });
    await simulateRefresh();
    expect((await getDocument("d1"))?.pages[0]?.text).toBe("hello");
  });

  it("persists study progress", async () => {
    const deck = emptyDeck("openalex:W1", "T");
    await saveDeck({ ...deck, knownCards: ["c1"], answers: { q1: 2 } });
    await simulateRefresh();
    const loaded = await getDeck("openalex:W1");
    expect(loaded?.knownCards).toEqual(["c1"]);
    expect(loaded?.answers).toEqual({ q1: 2 });
  });

  it("round-trips through JSON export/import, skipping duplicates and invalid entries", async () => {
    await savePaper(paper({ abstract: "An abstract." }));
    const json = libraryToJson(await listLibrary());
    await freshDb();
    const parsed = JSON.parse(json) as { entries: unknown[] };
    parsed.entries.push({ invalid: true });
    const result = await importLibraryJson(JSON.stringify(parsed));
    expect(result).toEqual({ imported: 1, skipped: 1 });
    expect((await importLibraryJson(json)).skipped).toBe(1);
    await expect(importLibraryJson("{nope")).rejects.toThrow(/not valid JSON/);
    await expect(importLibraryJson("{}")).rejects.toThrow(/not a PaperMind/);
  });
});

describe("library filtering and export", () => {
  const entries = [
    { paper: paper({ title: "Graph neural networks survey", year: 2021, authors: ["Kipf"] }), status: "reading" as const, tags: ["gnn"], notes: "", documentId: null, addedAt: "1", updatedAt: "1" },
    { paper: paper({ id: "openalex:W2", title: "Vision transformers | images", year: 2020, venue: "ICLR" }), status: "unread" as const, tags: [], notes: "patch embeddings", documentId: null, addedAt: "2", updatedAt: "2" },
  ];

  it("filters by text (incl. notes and authors), tag, year and status", () => {
    expect(filterLibrary(entries, { text: "kipf", tag: null, year: null, status: null })).toHaveLength(1);
    expect(filterLibrary(entries, { text: "patch", tag: null, year: null, status: null })[0]?.paper.id).toBe("openalex:W2");
    expect(filterLibrary(entries, { text: "", tag: "gnn", year: null, status: null })).toHaveLength(1);
    expect(filterLibrary(entries, { text: "", tag: null, year: 2020, status: null })).toHaveLength(1);
    expect(filterLibrary(entries, { text: "", tag: null, year: null, status: "completed" })).toHaveLength(0);
  });

  it("exports Markdown with explicit 'Not available' for missing metadata", () => {
    const md = libraryToMarkdown(entries, new Date("2026-01-01T00:00:00Z"));
    expect(md).toContain("## Graph neural networks survey");
    expect(md).toContain("- **Venue:** Not available");
    expect(md).toContain("- **Venue:** ICLR");
    expect(md).toContain("patch embeddings");
    expect(md).toContain("_No notes._");
  });
});
