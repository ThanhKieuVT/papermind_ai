"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Alert, Button, Spinner } from "@/components/ui/primitives";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5];

export function PdfViewer({
  pdf,
  page,
  onPageChange,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState(String(page));
  const scale = ZOOM_STEPS[zoomIndex] ?? 1;

  useEffect(() => setPageInput(String(page)), [page]);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;
    setRendering(true);
    setError(null);
    (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        task = pdfPage.render({
          canvasContext: ctx,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        });
        await task.promise;
      } catch (e) {
        const name = typeof e === "object" && e !== null && "name" in e ? String(e.name) : "";
        if (!cancelled && name !== "RenderingCancelledException") setError("This page could not be rendered.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, scale]);

  const go = (p: number) => onPageChange(Math.min(Math.max(1, p), pdf.numPages));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3 dark:border-stone-700" role="toolbar" aria-label="PDF controls">
        <Button size="sm" variant="secondary" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">←</Button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(pageInput);
            if (Number.isInteger(n)) go(n);
          }}
          className="flex items-center gap-1 text-sm"
        >
          <label htmlFor="page-input" className="sr-only">Page number</label>
          <input
            id="page-input"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            inputMode="numeric"
            className="w-14 rounded-md border border-stone-300 px-2 py-1 text-center dark:border-stone-600 dark:bg-stone-800"
          />
          <span className="text-stone-600 dark:text-stone-300">/ {pdf.numPages}</span>
        </form>
        <Button size="sm" variant="secondary" onClick={() => go(page + 1)} disabled={page >= pdf.numPages} aria-label="Next page">→</Button>
        <span className="mx-2 h-5 w-px bg-stone-300 dark:bg-stone-600" aria-hidden="true" />
        <Button size="sm" variant="secondary" onClick={() => setZoomIndex((z) => Math.max(0, z - 1))} disabled={zoomIndex === 0} aria-label="Zoom out">−</Button>
        <span className="w-12 text-center text-sm" aria-live="polite">{Math.round(scale * 100)}%</span>
        <Button size="sm" variant="secondary" onClick={() => setZoomIndex((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))} disabled={zoomIndex === ZOOM_STEPS.length - 1} aria-label="Zoom in">+</Button>
        {rendering && <Spinner className="h-4 w-4" />}
      </div>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
      <div className="mt-3 flex-1 overflow-auto rounded-lg bg-stone-100 p-4 dark:bg-stone-800">
        <canvas ref={canvasRef} className="mx-auto bg-white shadow" aria-label={`PDF page ${page}`} role="img" />
      </div>
    </div>
  );
}
