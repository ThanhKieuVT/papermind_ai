import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { makePdf } from "@/tests/fixtures/makePdf";
import { PdfInputError, describePdfError, extractDocumentText, textItemsToString, validatePdfBytes } from "@/lib/pdf/extract";

async function open(bytes: Uint8Array) {
  return getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
}

describe("PDF text extraction (real PDF.js)", () => {
  it("extracts per-page text and metadata from a text-based PDF", async () => {
    const bytes = makePdf(
      [
        ["Attention Mechanisms for Scientific Reading", "We propose a Long Short-Term Memory (LSTM) baseline."],
        ["Results: accuracy improves by 12.5 points on the benchmark."],
      ],
      { title: "Test Paper", author: "Ada Lovelace" },
    );
    validatePdfBytes(bytes, "test.pdf");
    const doc = await open(bytes);
    const result = await extractDocumentText(doc);
    expect(result.pageCount).toBe(2);
    expect(result.pages[0]?.page).toBe(1);
    expect(result.pages[0]?.text).toContain("Attention Mechanisms for Scientific Reading");
    expect(result.pages[0]?.text).toContain("Long Short-Term Memory (LSTM)");
    expect(result.pages[1]?.text).toContain("12.5 points");
    expect(result.info).toEqual({ title: "Test Paper", author: "Ada Lovelace" });
    expect(result.likelyScanned).toBe(false);
    await doc.destroy();
  });

  it("flags image-only (scanned-like) PDFs that contain no text", async () => {
    const doc = await open(makePdf([[], []]));
    const result = await extractDocumentText(doc);
    expect(result.totalChars).toBe(0);
    expect(result.likelyScanned).toBe(true);
    await doc.destroy();
  });

  it("reports progress for every page", async () => {
    const doc = await open(makePdf([["a page of text here"], ["another page"], ["third page"]]));
    const seen: number[] = [];
    await extractDocumentText(doc, (done) => seen.push(done));
    expect(seen).toEqual([1, 2, 3]);
    await doc.destroy();
  });

  it("rejects corrupt PDFs with a user-facing message", async () => {
    const corrupt = new TextEncoder().encode("%PDF-1.4\nthis is not really a pdf at all, no objects, no xref");
    validatePdfBytes(corrupt); // header looks fine…
    await expect(open(corrupt)).rejects.toSatisfy((e: unknown) => describePdfError(e) === "This file is corrupt or not a valid PDF.");
  });

  it("rejects non-PDF and empty files before parsing", () => {
    expect(() => validatePdfBytes(new TextEncoder().encode("hello world"), "notes.txt")).toThrow(PdfInputError);
    expect(() => validatePdfBytes(new Uint8Array(), "empty.pdf")).toThrow(/empty/);
  });

  it("rejects files above the size limit", () => {
    const big = new Uint8Array(50 * 1024 * 1024 + 1);
    big.set(new TextEncoder().encode("%PDF-1.4"));
    expect(() => validatePdfBytes(big, "big.pdf")).toThrow(/larger than 50 MB/);
  });
});

describe("textItemsToString", () => {
  it("joins items, honours EOL markers and re-joins hyphenated words", () => {
    const text = textItemsToString([
      { str: "Transfor-", hasEOL: true },
      { str: "mers are", hasEOL: false },
      { str: "great.", hasEOL: true },
      { notText: true },
      { str: "Next line", hasEOL: false },
    ]);
    expect(text).toBe("Transformers are great.\nNext line");
  });
});
