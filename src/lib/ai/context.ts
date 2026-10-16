import type { Paper, StoredDocument } from "@/types/paper";
import { abstractContext, chunkPages, selectContext, type SelectedContext } from "@/lib/ai/chunking";
import type { AiTask, SourceKind } from "@/lib/ai/types";

export interface PaperContext extends SelectedContext {
  source: SourceKind;
}

/**
 * Chooses the best available content for a paper: uploaded full text, else the
 * abstract, else nothing (metadata only). Scanned PDFs without text fall back.
 */
export function buildPaperContext(
  paper: Paper,
  doc: StoredDocument | null | undefined,
  opts: { task: AiTask; query?: string; budgetChars?: number },
): PaperContext {
  if (doc && !doc.likelyScanned) {
    const chunks = chunkPages(doc.pages);
    if (chunks.length > 0) {
      return { source: "fulltext", ...selectContext(chunks, { ...opts, totalPages: doc.pageCount }) };
    }
  }
  if (paper.abstract) return { source: "abstract", ...abstractContext(paper.abstract) };
  return {
    source: "metadata",
    excerpts: [],
    coverage: { pagesIncluded: [], totalPages: null, selectedChunks: 0, totalChunks: 0, complete: false },
  };
}

export function paperHeader(paper: Paper) {
  return { title: paper.title.slice(0, 500), authors: paper.authors.slice(0, 50), year: paper.year };
}
