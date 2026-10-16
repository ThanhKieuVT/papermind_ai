import { z } from "zod";

export const AI_TASKS = [
  "summary",
  "problem",
  "motivation",
  "contributions",
  "methodology",
  "terms",
  "equations",
  "experiments",
  "limitations",
  "question",
] as const;
export type AiTask = (typeof AI_TASKS)[number];

export const TASK_LABELS: Record<AiTask, string> = {
  summary: "Summarize the paper",
  problem: "Research problem",
  motivation: "Motivation & research gap",
  contributions: "Claimed contributions",
  methodology: "Methodology",
  terms: "Technical terms",
  equations: "Equations",
  experiments: "Datasets, baselines & metrics",
  limitations: "Limitations",
  question: "Ask a question",
};

/** Limits enforced on both client and server. */
export const LIMITS = {
  maxExcerpts: 60,
  maxExcerptChars: 4000,
  maxContextChars: 60_000,
  maxCompareContextChars: 90_000,
  maxQuestionChars: 2000,
  maxTitleChars: 500,
  maxAbstractChars: 6000,
} as const;

export const excerptSchema = z.object({
  id: z.string().regex(/^E\d{1,3}$/),
  /** 1-based PDF page, or null when the excerpt is from the abstract / metadata. */
  page: z.number().int().min(1).max(5000).nullable(),
  text: z.string().min(1).max(LIMITS.maxExcerptChars),
});
export type Excerpt = z.infer<typeof excerptSchema>;

export const coverageSchema = z.object({
  pagesIncluded: z.array(z.number().int().min(1)).max(5000),
  totalPages: z.number().int().min(0).nullable(),
  selectedChunks: z.number().int().min(0),
  totalChunks: z.number().int().min(0),
  complete: z.boolean(),
});
export type Coverage = z.infer<typeof coverageSchema>;

export type SourceKind = "fulltext" | "abstract" | "metadata";

// ---- Model output ----

export const STATEMENT_KINDS = ["paper", "background", "interpretation"] as const;
export type StatementKind = (typeof STATEMENT_KINDS)[number];

export interface EvidenceRef {
  excerptId: string;
  page: number | null;
  /** Quote verified to appear verbatim (modulo whitespace) in the excerpt; null if absent or not verified. */
  quote: string | null;
  quoteVerified: boolean;
}

export interface Statement {
  text: string;
  kind: StatementKind;
  evidence: EvidenceRef[];
}

export interface AnalysisSection {
  heading: string;
  statements: Statement[];
}

export type SupportStatus = "supported" | "partially_supported" | "not_supported";

export interface AnalysisResult {
  task: AiTask;
  status: SupportStatus;
  sections: AnalysisSection[];
  insufficientContextNote: string | null;
  source: SourceKind;
  coverage: Coverage;
  model: string;
}
