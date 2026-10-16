import { describe, expect, it } from "vitest";
import { COMPARISON_FIELDS } from "@/lib/ai/prompts";
import { cellText, comparisonToMarkdown, findUnverifiedNumbers, parseComparison, type CompareInputPaper } from "@/lib/compare/comparison";
import { compareRequestSchema } from "@/lib/validation/ai";

const inputs: CompareInputPaper[] = [
  {
    ref: "P1",
    paperId: "openalex:W1",
    title: "Paper One",
    year: 2020,
    source: "fulltext",
    excerpts: [{ id: "E1", page: 5, text: "We evaluate on SQuAD and obtain an F1 of 91.2 compared to BERT." }],
  },
  {
    ref: "P2",
    paperId: "openalex:W2",
    title: "Paper Two",
    year: 2021,
    source: "abstract",
    excerpts: [{ id: "E1", page: null, text: "We propose a sparse attention method for long documents." }],
  },
  { ref: "P3", paperId: "local:x", title: "Paper Three", year: null, source: "metadata", excerpts: [] },
];

describe("comparison parsing", () => {
  const modelText = JSON.stringify({
    papers: [
      {
        paper_id: "P1",
        fields: {
          datasets: { value: "SQuAD", evidence: ["E1"] },
          findings: { value: "F1 of 91.2 on SQuAD, beating BERT by 4.5 points", evidence: ["E1", "E9"] },
        },
      },
      { paper_id: "p2", fields: { method: { value: "Sparse attention", evidence: ["E1"] } } },
      { paper_id: "P3", fields: { method: { value: "Invented method", evidence: [] } } },
    ],
    synthesis: "Both target efficiency.",
  });
  const result = parseComparison(modelText, inputs, "test-model");

  it("produces a complete table: every paper has every field", () => {
    expect(result.papers).toHaveLength(3);
    for (const p of result.papers) expect(Object.keys(p.fields).sort()).toEqual([...COMPARISON_FIELDS].sort());
  });

  it("marks missing information explicitly", () => {
    const p1 = result.papers[0]!;
    expect(cellText(p1.fields.baselines, p1.source)).toBe("Not reported");
    const p3 = result.papers[2]!;
    // metadata-only papers cannot have AI-filled values
    expect(p3.fields.method.value).toBeNull();
    expect(cellText(p3.fields.method, p3.source)).toBe("Not available");
  });

  it("flags numbers that do not appear in the supplied text", () => {
    const findings = result.papers[0]!.fields.findings;
    expect(findings.unverifiedNumbers).toEqual(["4.5"]);
    expect(findings.evidencePages).toEqual([5]); // E9 was never supplied
    expect(findUnverifiedNumbers("accuracy 91.2%", "accuracy of 91.2 %")).toEqual([]);
  });

  it("labels abstract-based comparisons and exports Markdown", () => {
    expect(result.abstractBased).toBe(true);
    const md = comparisonToMarkdown(result);
    expect(md).toContain("| Evidence basis | Full text (selected excerpts) | Abstract only | Metadata only |");
    expect(md).toContain("Not reported");
    expect(md).toContain("unverified numbers: 4.5");
    expect(md).toContain("## Synthesis (AI interpretation)");
  });

  it("rejects invalid output", () => {
    expect(() => parseComparison('{"rows": []}', inputs, "m")).toThrow(/expected format/);
  });
});

describe("comparison request validation", () => {
  const p = { paperId: "a", paper: { title: "T", authors: [], year: null }, source: "abstract", excerpts: [] };
  it("requires 2–5 papers", () => {
    expect(compareRequestSchema.safeParse({ papers: [p] }).success).toBe(false);
    expect(compareRequestSchema.safeParse({ papers: [p, p] }).success).toBe(true);
    expect(compareRequestSchema.safeParse({ papers: [p, p, p, p, p, p] }).success).toBe(false);
  });
});
