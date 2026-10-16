"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { LibraryEntry, Paper, StoredDocument } from "@/types/paper";
import { openPdf } from "@/lib/pdf/client";
import { MAX_PDF_BYTES, PdfInputError, describePdfError, extractDocumentText, validatePdfBytes } from "@/lib/pdf/extract";
import { getDocument, getEntry, listDocuments, deleteDocument, saveDocument, savePaper, updateEntry } from "@/lib/storage/library";
import { errorMessage } from "@/lib/api/client";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { AiAssistantPanel } from "@/components/ai/AiAssistantPanel";
import { formatAuthors } from "@/components/papers/PaperMeta";
import { CatReading } from "@/components/ui/illustrations";

type LoadState = { kind: "idle" } | { kind: "loading"; label: string } | { kind: "error"; message: string } | { kind: "ready" };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Paper record for an uploaded PDF that is not (yet) linked to a library entry. */
export function localPaperFromDocument(doc: StoredDocument): Paper {
  return {
    id: `local:${doc.id}`,
    source: "local",
    openAlexId: null,
    doi: null,
    title: doc.info.title ?? doc.fileName.replace(/\.pdf$/i, ""),
    authors: doc.info.author ? doc.info.author.split(/\s*(?:;|,| and )\s*/).filter(Boolean) : [],
    year: null,
    venue: null,
    abstract: null,
    citationCount: null,
    url: null,
    pdfUrl: null,
    isOpenAccess: null,
    concepts: [],
  };
}

export function ReaderView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const notify = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [doc, setDoc] = useState<StoredDocument | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"text" | "ai">("text");
  const [recent, setRecent] = useState<StoredDocument[]>([]);

  const paperId = params.get("paper");
  const docId = params.get("doc");

  const showDocument = useCallback(async (stored: StoredDocument) => {
    setDoc(stored);
    setPage(1);
    if (!stored.blob) {
      setPdf(null);
      setState({ kind: "ready" });
      return;
    }
    setState({ kind: "loading", label: "Opening PDF…" });
    const bytes = new Uint8Array(await stored.blob.arrayBuffer());
    const opened = await openPdf(bytes);
    setPdf((old) => {
      void old?.destroy();
      return opened;
    });
    setState({ kind: "ready" });
  }, []);

  // Load the document referenced by the URL (?paper=… or ?doc=…).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let linkedEntry: LibraryEntry | null = null;
        let targetDocId = docId;
        if (paperId) {
          linkedEntry = (await getEntry(paperId)) ?? null;
          if (!linkedEntry) throw new Error("That paper is not in your library.");
          targetDocId = linkedEntry.documentId;
        }
        if (!active) return;
        setEntry(linkedEntry);
        if (targetDocId) {
          const stored = await getDocument(targetDocId);
          if (!stored) throw new Error("The stored PDF could not be found in this browser. Please upload it again.");
          if (active) await showDocument(stored);
        } else {
          setDoc(null);
          setPdf(null);
          setState({ kind: "idle" });
          setRecent(await listDocuments());
        }
      } catch (e) {
        if (active) setState({ kind: "error", message: describeLoadError(e) });
      }
    })();
    return () => {
      active = false;
    };
  }, [paperId, docId, showDocument]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_PDF_BYTES) throw new Error(`"${file.name}" is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB.`);
      setState({ kind: "loading", label: "Reading file…" });
      const bytes = new Uint8Array(await file.arrayBuffer());
      validatePdfBytes(bytes, file.name);
      setState({ kind: "loading", label: "Opening PDF…" });
      const opened = await openPdf(bytes);
      const extraction = await extractDocumentText(opened, (done, total) =>
        setState({ kind: "loading", label: `Extracting text… page ${done} of ${total}` }),
      );
      await opened.destroy();
      const stored: StoredDocument = {
        id: newId(),
        fileName: file.name,
        fileSize: file.size,
        pageCount: extraction.pageCount,
        pages: extraction.pages,
        info: extraction.info,
        likelyScanned: extraction.likelyScanned,
        createdAt: new Date().toISOString(),
        blob: new Blob([bytes], { type: "application/pdf" }),
      };
      await saveDocument(stored);
      if (entry) {
        await updateEntry(entry.paper.id, { documentId: stored.id });
        notify("PDF attached to this library paper.");
        await showDocument(stored);
        setEntry({ ...entry, documentId: stored.id });
      } else {
        router.replace(`${pathname}?doc=${stored.id}`);
      }
    } catch (e) {
      setState({ kind: "error", message: describeUploadError(e) });
    }
  };

  const saveToLibrary = async () => {
    if (!doc) return;
    try {
      const paper = localPaperFromDocument(doc);
      const result = await savePaper(paper, { documentId: doc.id });
      notify(result.status === "saved" ? "Saved to your library." : "Already in your library.", result.status === "saved" ? "success" : "info");
      router.replace(`${pathname}?paper=${encodeURIComponent(result.entry.paper.id)}`);
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  };

  const paper = entry?.paper ?? (doc ? localPaperFromDocument(doc) : null);
  const pageText = doc?.pages.find((p) => p.page === page)?.text ?? "";

  return (
    <>
      <PageHeader
        title="PDF Reader"
        description="PDFs are processed entirely in your browser and stored locally (IndexedDB). Nothing is uploaded unless you run an AI action, which sends extracted text — not the file — to the server."
        actions={
          <>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onFile} id="pdf-upload" aria-label="Upload PDF" />
            <Button onClick={() => fileInput.current?.click()} disabled={state.kind === "loading"}>
              {entry ? (doc ? "Replace PDF" : "Attach PDF") : "Upload PDF"}
            </Button>
            {doc && !entry && <Button variant="secondary" onClick={saveToLibrary}>Save to library</Button>}
          </>
        }
      />

      {entry && (
        <Card className="mb-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Library paper</p>
          <p className="font-semibold">{entry.paper.title}</p>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {formatAuthors(entry.paper.authors)}{entry.paper.year ? ` · ${entry.paper.year}` : ""}{entry.paper.venue ? ` · ${entry.paper.venue}` : ""}
          </p>
        </Card>
      )}

      {state.kind === "loading" && <Spinner label={state.label} />}
      {state.kind === "error" && <Alert tone="error" title="Could not open PDF" className="mb-4">{state.message}</Alert>}

      {state.kind !== "loading" && !doc && (
        <>
          {entry ? (
            <div className="space-y-4">
              <EmptyState title="No PDF attached" action={<Button onClick={() => fileInput.current?.click()}>Attach PDF</Button>}>
                Attach a PDF of this paper to read it here and analyze its full text.
                {entry.paper.pdfUrl && (
                  <> An open-access copy may be available <a className="text-brand-700 underline dark:text-brand-300" href={entry.paper.pdfUrl} target="_blank" rel="noopener noreferrer">here ↗</a> — download it, then attach it.</>
                )}
              </EmptyState>
              {paper && <Card><AiAssistantPanel paper={paper} doc={null} /></Card>}
            </div>
          ) : (
            <RecentDocuments
              docs={recent}
              onOpen={(id) => router.replace(`${pathname}?doc=${id}`)}
              onDelete={async (id) => {
                await deleteDocument(id);
                setRecent(await listDocuments());
              }}
              onUpload={() => fileInput.current?.click()}
            />
          )}
        </>
      )}

      {doc && state.kind !== "loading" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card className="min-h-[70vh]">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{doc.fileName}</span>
              <Badge>{doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}</Badge>
              {doc.info.title && <Badge tone="blue" title="Title from PDF metadata">PDF title: {doc.info.title}</Badge>}
              {doc.likelyScanned && <Badge tone="amber">Scanned / image-only</Badge>}
            </div>
            {pdf ? <PdfViewer pdf={pdf} page={page} onPageChange={setPage} /> : <Alert tone="warning">The original PDF file is not stored; only extracted text is available.</Alert>}
          </Card>
          <Card>
            <div role="tablist" aria-label="Reader panels" className="mb-4 flex gap-1 border-b border-stone-200 dark:border-stone-700">
              {(["text", "ai"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  aria-controls={`panel-${t}`}
                  id={`tab-${t}`}
                  onClick={() => setTab(t)}
                  className={cx(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                    tab === t ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-stone-600 hover:text-stone-900 dark:text-stone-300",
                  )}
                >
                  {t === "text" ? "Extracted text" : "AI assistant"}
                </button>
              ))}
            </div>
            <div role="tabpanel" id="panel-text" aria-labelledby="tab-text" hidden={tab !== "text"}>
              {doc.likelyScanned && (
                <Alert tone="warning" className="mb-3">
                  Very little text could be extracted. This PDF is probably scanned or image-only; OCR is not supported in this version.
                </Alert>
              )}
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Page {page} text</h2>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!pageText}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pageText);
                      notify("Page text copied.");
                    } catch {
                      notify("Copy failed — select the text manually.", "error");
                    }
                  }}
                >
                  Copy page text
                </Button>
              </div>
              <div className="max-h-[60vh] select-text overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm leading-relaxed dark:bg-stone-800" tabIndex={0} aria-label={`Extracted text of page ${page}`}>
                {pageText || <span className="italic text-stone-500">No text extracted from this page.</span>}
              </div>
            </div>
            <div role="tabpanel" id="panel-ai" aria-labelledby="tab-ai" hidden={tab !== "ai"}>
              {paper && <AiAssistantPanel paper={paper} doc={doc} onJumpToPage={setPage} />}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

/** PDF.js exceptions and validation errors get curated messages; our own plain errors keep theirs. */
function describeUploadError(e: unknown): string {
  const isPdfJsError = e instanceof Error && /Exception$/.test(e.name);
  if (isPdfJsError || e instanceof PdfInputError || !(e instanceof Error)) return describePdfError(e);
  return describeLoadError(e);
}

function describeLoadError(e: unknown): string {
  const msg = errorMessage(e);
  return msg.includes("IndexedDB") ? "Local storage is unavailable in this browser (private mode?)." : msg;
}

function RecentDocuments({
  docs,
  onOpen,
  onDelete,
  onUpload,
}: {
  docs: StoredDocument[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onUpload: () => void;
}) {
  if (docs.length === 0) {
    return (
      <EmptyState title="Open a research paper" illustration={<CatReading className="h-32 w-44" />} action={<Button onClick={onUpload}>Upload PDF</Button>}>
        Upload a text-based PDF (max {MAX_PDF_BYTES / 1024 / 1024} MB) to render it, extract its text and use the AI assistant.
      </EmptyState>
    );
  }
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Recently opened PDFs (stored in this browser)</h2>
      <ul className="divide-y divide-stone-200 dark:divide-stone-700">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p className="font-medium">{d.info.title ?? d.fileName}</p>
              <p className="text-xs text-stone-500">
                {d.fileName} · {d.pageCount} {d.pageCount === 1 ? "page" : "pages"} · {(d.fileSize / 1024 / 1024).toFixed(1)} MB · {new Date(d.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onOpen(d.id)}>Open</Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(d.id)} aria-label={`Delete ${d.fileName}`}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
