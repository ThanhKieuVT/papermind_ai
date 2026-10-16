"use client";

import Link from "next/link";
import { useState } from "react";
import type { LibraryEntry } from "@/types/paper";
import { useLibrary } from "@/hooks/useLibrary";
import { getDocument } from "@/lib/storage/library";
import { buildPaperContext, paperHeader } from "@/lib/ai/context";
import { LIBRARY_COMPARE_QUERY, compareBudgetPerPaper } from "@/lib/compare/request";
import { COMPARISON_FIELDS, COMPARISON_FIELD_LABELS } from "@/lib/ai/prompts";
import { cellText, comparisonToMarkdown, type ComparisonResult } from "@/lib/compare/comparison";
import type { SourceKind } from "@/lib/ai/types";
import { downloadText } from "@/lib/export/markdown";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui/primitives";
import { useAiAvailability } from "@/components/ai/AiStatusNotice";

const MIN = 2;
const MAX = 5;

const SOURCE_BADGE: Record<SourceKind, { label: string; tone: "green" | "amber" | "red" }> = {
  fulltext: { label: "Full text", tone: "green" },
  abstract: { label: "Abstract only", tone: "amber" },
  metadata: { label: "Metadata only", tone: "red" },
};

function likelySource(entry: LibraryEntry): SourceKind {
  if (entry.documentId) return "fulltext";
  return entry.paper.abstract ? "abstract" : "metadata";
}

export function CompareView() {
  const { entries, loading, error } = useLibrary();
  const { ready, notice } = useAiAvailability();
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX ? s : [...s, id]));

  const chosen = entries.filter((e) => selected.includes(e.paper.id));

  const run = async () => {
    setRunning(true);
    setRunError(null);
    try {
      const budget = compareBudgetPerPaper(chosen.length);
      const papers = await Promise.all(
        chosen.map(async (entry) => {
          const doc = entry.documentId ? await getDocument(entry.documentId) : undefined;
          const ctx = buildPaperContext(entry.paper, doc, { task: "summary", query: LIBRARY_COMPARE_QUERY, budgetChars: budget });
          return { paperId: entry.paper.id, paper: paperHeader(entry.paper), source: ctx.source, excerpts: ctx.excerpts };
        }),
      );
      if (papers.every((p) => p.excerpts.length === 0)) {
        throw new Error("None of the selected papers has an abstract or attached PDF, so there is nothing to compare.");
      }
      setResult(await apiFetch<ComparisonResult>("/api/ai/compare", { method: "POST", body: JSON.stringify({ papers }) }));
    } catch (e) {
      setRunError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Compare Papers"
        description={`Select ${MIN}–${MAX} papers from your library. The comparison uses attached PDF text when available, otherwise the abstract — and says which.`}
        actions={
          result && (
            <Button variant="secondary" onClick={() => downloadText(`papermind-comparison-${new Date().toISOString().slice(0, 10)}.md`, comparisonToMarkdown(result))}>
              Export Markdown
            </Button>
          )
        }
      />
      {loading && <Spinner label="Loading library…" />}
      {error && <Alert tone="error">{error}</Alert>}
      {!loading && entries.length < MIN && (
        <EmptyState title="Not enough papers" action={<Link href="/discover" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Discover papers →</Link>}>
          Save at least {MIN} papers to your library to compare them.
        </EmptyState>
      )}

      {entries.length >= MIN && (
        <Card className="mb-6">
          <fieldset>
            <legend className="mb-3 font-semibold">Select papers ({selected.length}/{MAX})</legend>
            <ul className="max-h-72 space-y-1 overflow-auto">
              {entries.map((entry) => {
                const src = SOURCE_BADGE[likelySource(entry)];
                const checked = selected.includes(entry.paper.id);
                return (
                  <li key={entry.paper.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-stone-50 dark:hover:bg-stone-800">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        disabled={!checked && selected.length >= MAX}
                        onChange={() => toggle(entry.paper.id)}
                      />
                      <span className="flex-1 text-sm">
                        <span className="font-medium">{entry.paper.title}</span>{" "}
                        <span className="text-stone-500">{entry.paper.year ?? ""}</span>{" "}
                        <Badge tone={src.tone}>{src.label}</Badge>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <div className="mt-4 space-y-3">
            {notice}
            {ready && (
              <Button onClick={run} loading={running} disabled={selected.length < MIN}>
                {selected.length < MIN ? `Select at least ${MIN} papers` : `Compare ${selected.length} papers`}
              </Button>
            )}
            {runError && <Alert tone="error" title="Comparison failed">{runError}</Alert>}
          </div>
        </Card>
      )}

      {result && <ComparisonTable result={result} />}
      {!result && chosen.length >= MIN && !ready && <MetadataTable entries={chosen} />}
    </>
  );
}

function ComparisonTable({ result }: { result: ComparisonResult }) {
  return (
    <Card>
      <div className="mb-3 space-y-2">
        {result.abstractBased ? (
          <Alert tone="warning" title="Abstract-based comparison">
            At least one paper was compared using only its abstract (or metadata). Methods, datasets and results may be missing or incomplete for those papers.
          </Alert>
        ) : (
          <Alert tone="info">Based on selected excerpts of each paper&apos;s full text. Cells marked “Not reported” were not found in the supplied text.</Alert>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">Comparison of selected papers</caption>
          <thead>
            <tr>
              <th scope="col" className="w-44 border-b border-stone-200 p-2 text-left dark:border-stone-700">Aspect</th>
              {result.papers.map((p) => (
                <th key={p.ref} scope="col" className="border-b border-stone-200 p-2 text-left align-top dark:border-stone-700">
                  <span className="font-semibold">{p.title}</span> {p.year && <span className="font-normal text-stone-500">({p.year})</span>}
                  <div className="mt-1"><Badge tone={SOURCE_BADGE[p.source].tone}>{SOURCE_BADGE[p.source].label}</Badge></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_FIELDS.map((field) => (
              <tr key={field} className="align-top">
                <th scope="row" className="border-b border-stone-100 p-2 text-left font-medium text-stone-700 dark:border-stone-800 dark:text-stone-200">
                  {COMPARISON_FIELD_LABELS[field]}
                  {field === "gaps" && <div className="text-xs font-normal text-amber-700 dark:text-amber-300">AI interpretation</div>}
                </th>
                {result.papers.map((p) => {
                  const cell = p.fields[field];
                  const pages = [...new Set(cell.evidencePages.filter((x): x is number => x !== null))];
                  return (
                    <td key={p.ref} className="border-b border-stone-100 p-2 dark:border-stone-800">
                      <span className={cell.value ? "" : "italic text-stone-500"}>{cellText(cell, p.source)}</span>
                      {pages.length > 0 && <span className="ml-1 text-xs text-stone-500">(p. {pages.join(", ")})</span>}
                      {cell.unverifiedNumbers.length > 0 && (
                        <div className="mt-1 text-xs text-red-700 dark:text-red-300">
                          ⚠ Numbers not found in supplied text: {cell.unverifiedNumbers.join(", ")} — verify before use.
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.synthesis && (
        <div className="mt-4">
          <h3 className="font-semibold">Synthesis <Badge tone="amber">AI interpretation</Badge></h3>
          <p className="mt-1 text-sm leading-relaxed">{result.synthesis}</p>
        </div>
      )}
      <p className="mt-3 text-xs text-stone-400">Generated by {result.model} at {new Date(result.generatedAt).toLocaleString()}.</p>
    </Card>
  );
}

/** Shown when AI is unavailable: only real metadata, analytic fields clearly unavailable. */
function MetadataTable({ entries }: { entries: LibraryEntry[] }) {
  const rows: [string, (e: LibraryEntry) => string][] = [
    ["Authors", (e) => (e.paper.authors.length ? e.paper.authors.slice(0, 6).join(", ") : "Not available")],
    ["Year", (e) => (e.paper.year ? String(e.paper.year) : "Not available")],
    ["Venue", (e) => e.paper.venue ?? "Not available"],
    ["Citations", (e) => (e.paper.citationCount !== null ? e.paper.citationCount.toLocaleString() : "Not available")],
    ["Abstract", (e) => e.paper.abstract ?? "Not available"],
  ];
  return (
    <Card>
      <Alert tone="info" className="mb-3">AI is unavailable, so only bibliographic metadata is shown. Method, datasets, results and limitations require the AI comparison.</Alert>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-32 border-b p-2 text-left dark:border-stone-700">Field</th>
              {entries.map((e) => <th key={e.paper.id} scope="col" className="border-b p-2 text-left dark:border-stone-700">{e.paper.title}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label} className="align-top">
                <th scope="row" className="border-b p-2 text-left font-medium dark:border-stone-800">{label}</th>
                {entries.map((e) => <td key={e.paper.id} className="border-b p-2 dark:border-stone-800">{get(e)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
