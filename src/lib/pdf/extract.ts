import type { PageText } from "@/types/paper";

/** Structural subset of the PDF.js document API that extraction relies on. */
export interface PdfTextItemLike {
  str?: string;
  hasEOL?: boolean;
}
export interface PdfPageLike {
  getTextContent(): Promise<{ items: unknown[] }>;
}
export interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
  getMetadata?(): Promise<{ info?: unknown }>;
}

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
/** Pages averaging fewer extracted characters than this are treated as image-only. */
const SCANNED_CHARS_PER_PAGE = 40;

export class PdfInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfInputError";
  }
}

/** Fast pre-checks before handing bytes to PDF.js. Throws PdfInputError with a user-facing message. */
export function validatePdfBytes(bytes: Uint8Array, fileName = "file"): void {
  if (bytes.byteLength === 0) throw new PdfInputError(`"${fileName}" is empty.`);
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new PdfInputError(`"${fileName}" is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB.`);
  }
  // The %PDF- header must appear within the first 1024 bytes.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (!head.includes("%PDF-")) throw new PdfInputError(`"${fileName}" does not look like a PDF file.`);
}

function isTextItem(item: unknown): item is PdfTextItemLike {
  return typeof item === "object" && item !== null && "str" in item;
}

/** Joins PDF.js text items into readable text, respecting end-of-line markers. */
export function textItemsToString(items: unknown[]): string {
  let out = "";
  for (const item of items) {
    if (!isTextItem(item)) continue;
    const str = item.str ?? "";
    if (str) {
      const needsSpace = out.length > 0 && !/[\s-]$/.test(out) && !/^\s/.test(str);
      out += (needsSpace ? " " : "") + str;
    }
    if (item.hasEOL) out += "\n";
  }
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/(\w)-\n(\w)/g, "$1$2") // re-join words hyphenated across lines
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ExtractionResult {
  pageCount: number;
  pages: PageText[];
  info: { title: string | null; author: string | null };
  likelyScanned: boolean;
  totalChars: number;
}

function readInfoString(info: unknown, key: string): string | null {
  if (typeof info !== "object" || info === null) return null;
  const value = (info as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function extractDocumentText(
  doc: PdfDocumentLike,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractionResult> {
  const pages: PageText[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push({ page: n, text: textItemsToString(content.items) });
    onProgress?.(n, doc.numPages);
  }
  let info: ExtractionResult["info"] = { title: null, author: null };
  try {
    const meta = await doc.getMetadata?.();
    info = { title: readInfoString(meta?.info, "Title"), author: readInfoString(meta?.info, "Author") };
  } catch {
    // Metadata is optional; ignore malformed info dictionaries.
  }
  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
  const likelyScanned = doc.numPages > 0 && totalChars / doc.numPages < SCANNED_CHARS_PER_PAGE;
  return { pageCount: doc.numPages, pages, info, likelyScanned, totalChars };
}

/** Maps PDF.js exception names to user-facing messages. */
export function describePdfError(error: unknown): string {
  if (error instanceof PdfInputError) return error.message;
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  if (name === "PasswordException") return "This PDF is password-protected and cannot be opened.";
  if (name === "InvalidPDFException") return "This file is corrupt or not a valid PDF.";
  if (name === "MissingPDFException") return "The PDF could not be found.";
  return "The PDF could not be opened. It may be corrupt or use unsupported features.";
}
