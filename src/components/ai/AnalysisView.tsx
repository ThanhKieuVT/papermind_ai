"use client";

import type { AnalysisResult, StatementKind } from "@/lib/ai/types";
import { TASK_LABELS } from "@/lib/ai/types";
import { Alert, Badge } from "@/components/ui/primitives";

const KIND_LABEL: Record<StatementKind, { label: string; tone: "green" | "blue" | "amber"; title: string }> = {
  paper: { label: "From paper", tone: "green", title: "Supported by the supplied paper text" },
  background: { label: "Background", tone: "blue", title: "General knowledge, not taken from this paper" },
  interpretation: { label: "Interpretation", tone: "amber", title: "AI inference or uncertain reading — verify yourself" },
};

const STATUS_LABEL: Record<AnalysisResult["status"], { label: string; tone: "green" | "amber" | "red" }> = {
  supported: { label: "Supported by the text", tone: "green" },
  partially_supported: { label: "Partially supported", tone: "amber" },
  not_supported: { label: "Not supported by the supplied text", tone: "red" },
};

export function CoverageNote({ result }: { result: Pick<AnalysisResult, "source" | "coverage"> }) {
  const { source, coverage } = result;
  if (source === "abstract") {
    return <Alert tone="warning">Based on the <strong>abstract only</strong> — no full text was available. Upload the PDF for a deeper analysis.</Alert>;
  }
  if (source === "metadata") return <Alert tone="warning">Only metadata was available; no paper text was analyzed.</Alert>;
  if (coverage.complete) {
    return <p className="text-xs text-stone-500 dark:text-stone-400">Analyzed the full extracted text{coverage.totalPages ? ` (${coverage.totalPages} pages)` : ""}.</p>;
  }
  return (
    <Alert tone="info">
      The paper was too long to send in full. Only the {coverage.selectedChunks} most relevant of {coverage.totalChunks} text chunks were analyzed
      (pages {coverage.pagesIncluded.join(", ")}{coverage.totalPages ? ` of ${coverage.totalPages}` : ""}). Content outside these pages was not read.
    </Alert>
  );
}

export function AnalysisView({
  result,
  question,
  onJumpToPage,
}: {
  result: AnalysisResult;
  question?: string | null;
  onJumpToPage?: (page: number) => void;
}) {
  const status = STATUS_LABEL[result.status];
  return (
    <article className="space-y-3 rounded-lg border border-stone-200 p-4 dark:border-stone-700">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{TASK_LABELS[result.task]}</h3>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>
      {question && <p className="text-sm italic text-stone-600 dark:text-stone-300">Q: {question}</p>}
      <CoverageNote result={result} />
      {result.insufficientContextNote && <Alert tone="warning" title="Limited evidence">{result.insufficientContextNote}</Alert>}
      {result.sections.length === 0 && <p className="text-sm text-stone-500">The AI returned no content.</p>}
      {result.sections.map((section, si) => (
        <section key={si}>
          <h4 className="mb-1 text-sm font-semibold text-stone-800 dark:text-stone-100">{section.heading}</h4>
          <ul className="space-y-2">
            {section.statements.map((st, i) => {
              const kind = KIND_LABEL[st.kind];
              return (
                <li key={i} className="text-sm leading-relaxed">
                  <Badge tone={kind.tone} title={kind.title}>{kind.label}</Badge>{" "}
                  <span>{st.text}</span>
                  {st.evidence.length > 0 && (
                    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                      {st.evidence.map((ev, j) =>
                        ev.page && onJumpToPage ? (
                          <button
                            key={j}
                            type="button"
                            onClick={() => onJumpToPage(ev.page!)}
                            className="rounded bg-stone-100 px-1.5 text-xs text-brand-700 hover:underline dark:bg-stone-800 dark:text-brand-300"
                            title={`Go to page ${ev.page}`}
                          >
                            p. {ev.page}
                          </button>
                        ) : (
                          <span key={j} className="rounded bg-stone-100 px-1.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                            {ev.page ? `p. ${ev.page}` : "abstract"}
                          </span>
                        ),
                      )}
                    </span>
                  )}
                  {st.evidence.filter((ev) => ev.quoteVerified && ev.quote).map((ev, j) => (
                    <blockquote key={j} className="mt-1 border-l-2 border-emerald-400 pl-3 text-xs text-stone-600 dark:text-stone-300">
                      “{ev.quote}” <span className="text-stone-400">— {ev.page ? `page ${ev.page}` : "abstract"}, verified in text</span>
                    </blockquote>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <footer className="text-xs text-stone-400">Generated by {result.model}. AI output can be wrong — check the cited pages.</footer>
    </article>
  );
}
