import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { extractJson } from "@/lib/ai/parse";
import { COMPARISON_FIELDS, COMPARISON_FIELD_LABELS, type ComparisonField } from "@/lib/ai/prompts";
import type { Excerpt, SourceKind } from "@/lib/ai/types";
import { mdCell } from "@/lib/export/markdown";

export const NOT_REPORTED = "Not reported";
export const NOT_AVAILABLE = "Not available";

export interface ComparisonCell {
  value: string | null;
  /** Pages of the evidence excerpts (null entries = abstract). */
  evidencePages: (number | null)[];
  /** Numbers in the value that do not appear anywhere in the supplied text for this paper. */
  unverifiedNumbers: string[];
}

export interface ComparedPaper {
  ref: string;
  paperId: string;
  title: string;
  year: number | null;
  source: SourceKind;
  fields: Record<ComparisonField, ComparisonCell>;
}

export interface ComparisonResult {
  papers: ComparedPaper[];
  synthesis: string | null;
  /** True when at least one paper was compared without full text. */
  abstractBased: boolean;
  model: string;
  generatedAt: string;
}

const rawCellSchema = z
  .object({ value: z.string().nullish(), evidence: z.array(z.string()).nullish() })
  .nullish();

const rawComparisonSchema = z.object({
  papers: z.array(z.object({ paper_id: z.string(), fields: z.record(z.string(), rawCellSchema).default({}) })),
  synthesis: z.string().nullish(),
});

/** Numbers like 12, 3.5, 87.2%, 0.91 (ignores single digits, which are too ambiguous). */
export function extractNumbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?%?/g) ?? []).filter((n) => n.replace(/\D/g, "").length >= 2);
}

export function findUnverifiedNumbers(value: string, sourceText: string): string[] {
  const source = sourceText.replace(/,/g, "");
  return extractNumbers(value).filter((n) => !source.includes(n.replace(/,/g, "").replace(/%$/, "")));
}

export interface CompareInputPaper {
  ref: string;
  paperId: string;
  title: string;
  year: number | null;
  source: SourceKind;
  excerpts: Excerpt[];
}

/** Turns model output into a complete table: every paper has every field, missing ones are null. */
export function parseComparison(text: string, inputs: CompareInputPaper[], model: string): ComparisonResult {
  const parsed = rawComparisonSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new ApiError("bad_ai_response", "The AI comparison did not match the expected format. Please try again.");
  }
  const byRef = new Map(parsed.data.papers.map((p) => [p.paper_id.trim().toUpperCase(), p.fields]));

  const papers: ComparedPaper[] = inputs.map((input) => {
    const raw = byRef.get(input.ref) ?? {};
    const sourceText = input.excerpts.map((e) => e.text).join("\n");
    const excerptPages = new Map(input.excerpts.map((e) => [e.id, e.page]));
    const fields = {} as Record<ComparisonField, ComparisonCell>;
    for (const field of COMPARISON_FIELDS) {
      const cell = raw[field];
      const value = cell?.value?.trim() || null;
      const usable = input.excerpts.length > 0 ? value : null;
      fields[field] = {
        value: usable,
        evidencePages: (cell?.evidence ?? [])
          .map((id) => id.trim().toUpperCase())
          .filter((id) => excerptPages.has(id))
          .map((id) => excerptPages.get(id) ?? null),
        unverifiedNumbers: usable && field !== "gaps" ? findUnverifiedNumbers(usable, sourceText) : [],
      };
    }
    return { ref: input.ref, paperId: input.paperId, title: input.title, year: input.year, source: input.source, fields };
  });

  return {
    papers,
    synthesis: parsed.data.synthesis?.trim() || null,
    abstractBased: inputs.some((p) => p.source !== "fulltext"),
    model,
    generatedAt: new Date().toISOString(),
  };
}

export function cellText(cell: ComparisonCell, source: SourceKind): string {
  if (cell.value) return cell.value;
  return source === "metadata" ? NOT_AVAILABLE : NOT_REPORTED;
}

const SOURCE_LABEL: Record<SourceKind, string> = {
  fulltext: "Full text (selected excerpts)",
  abstract: "Abstract only",
  metadata: "Metadata only",
};

export function comparisonToMarkdown(result: ComparisonResult): string {
  const header = `| Aspect | ${result.papers.map((p) => mdCell(`${p.title}${p.year ? ` (${p.year})` : ""}`)).join(" | ")} |`;
  const sep = `|---|${result.papers.map(() => "---").join("|")}|`;
  const basis = `| Evidence basis | ${result.papers.map((p) => SOURCE_LABEL[p.source]).join(" | ")} |`;
  const rows = COMPARISON_FIELDS.map((f) => {
    const cells = result.papers.map((p) => {
      const cell = p.fields[f];
      const warn = cell.unverifiedNumbers.length ? ` ⚠️ unverified numbers: ${cell.unverifiedNumbers.join(", ")}` : "";
      return mdCell(cellText(cell, p.source) + warn);
    });
    return `| ${COMPARISON_FIELD_LABELS[f]} | ${cells.join(" | ")} |`;
  });
  const lines = [
    "# Paper comparison",
    "",
    `Generated: ${result.generatedAt} · Model: ${result.model}`,
    "",
    result.abstractBased
      ? "> **Note:** At least one paper was compared using only its abstract or metadata. Cells may be incomplete."
      : "> Comparison is based on selected excerpts of the uploaded full texts.",
    "",
    header,
    sep,
    basis,
    ...rows,
    "",
  ];
  if (result.synthesis) lines.push("## Synthesis (AI interpretation)", "", result.synthesis, "");
  return lines.join("\n");
}
