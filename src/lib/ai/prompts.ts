import type { AiTask, Coverage, Excerpt, SourceKind } from "@/lib/ai/types";

export interface PaperHeader {
  title: string;
  authors: string[];
  year: number | null;
}

const GROUNDING_RULES = `Grounding rules (mandatory):
- Use ONLY the numbered excerpts as evidence about this paper. Never invent quotations, page numbers, equations, numbers, datasets or references.
- Classify every statement with "kind":
  * "paper": directly supported by the excerpts. Cite the excerpt ids in "evidence"; "quote" must be copied verbatim from that excerpt (max 25 words) or be null.
  * "background": general domain knowledge that is NOT taken from the paper (explanations of standard concepts). No evidence.
  * "interpretation": your inference or uncertain reading. Cite excerpts it is based on, if any.
- If the excerpts do not contain enough information, say so in "insufficient_context_note" and set "status" to "partially_supported" or "not_supported". Do not guess.
- Do not mention page numbers yourself; the application derives them from excerpt ids.
- Text was extracted automatically from a PDF and may contain broken formatting (especially math). Mention this when it affects your answer.`;

const OUTPUT_SCHEMA = `Respond with a single JSON object exactly of this shape:
{
  "status": "supported" | "partially_supported" | "not_supported",
  "sections": [
    { "heading": string,
      "statements": [ { "text": string, "kind": "paper" | "background" | "interpretation",
                        "evidence": [ { "excerpt_id": "E1", "quote": string | null } ] } ] }
  ],
  "insufficient_context_note": string | null
}`;

const TASK_INSTRUCTIONS: Record<AiTask, string> = {
  summary:
    "Write a structured summary of the paper: research problem, approach, main results, and conclusions. Use 3-5 sections.",
  problem: "Explain the research problem the paper addresses and why it matters, in plain language.",
  motivation:
    "Identify the motivation and the research gap: what limitation of prior work or open need the authors claim to address.",
  contributions: "List the contributions the authors explicitly claim. Do not add contributions they do not claim.",
  methodology:
    "Explain the methodology step by step: inputs, model/algorithm components, training or procedure, and key design choices.",
  terms:
    "Identify 5-12 important technical terms or acronyms used in the excerpts and explain each one. Mark the definition as 'paper' only when the excerpt itself defines the term; otherwise 'background'.",
  equations:
    "Explain the equations that appear in the excerpts: what each symbol denotes (only as defined in the text) and what the equation computes. If no equations are present or they are too garbled to interpret, say so explicitly instead of reconstructing them.",
  experiments:
    "Describe the datasets, baselines, and evaluation metrics, and the main reported results. Report numbers only if they appear verbatim in the excerpts. Use sections: Datasets, Baselines, Metrics, Results.",
  limitations:
    "Identify limitations: those the authors acknowledge (kind 'paper') and potential additional ones you infer (kind 'interpretation').",
  question:
    "Answer the user's question about this paper. If the excerpts do not answer it, set status to 'not_supported' and explain what is missing; you may add clearly-labelled background.",
};

export const ANALYSIS_SYSTEM_PROMPT = `You are PaperMind, a careful research assistant who helps people read scientific papers.
You are rigorous about separating what a paper says from general knowledge and from your own interpretation.
${GROUNDING_RULES}
${OUTPUT_SCHEMA}`;

function describeSource(source: SourceKind, coverage: Coverage): string {
  if (source === "abstract") return "Only the paper's abstract is available (no full text).";
  if (source === "metadata") return "Only bibliographic metadata is available (no abstract or full text).";
  const pages = coverage.totalPages ? ` of ${coverage.totalPages} pages` : "";
  return coverage.complete
    ? `The full extracted text of the paper is provided${pages}.`
    : `Only ${coverage.selectedChunks} of ${coverage.totalChunks} text chunks (from pages ${coverage.pagesIncluded.join(", ")}${pages}) were selected as most relevant. Other parts of the paper were NOT provided; do not claim to have read them.`;
}

export function formatExcerpts(excerpts: Excerpt[]): string {
  return excerpts
    .map((e) => `[${e.id}]${e.page ? ` (page ${e.page})` : " (abstract)"}\n${e.text}`)
    .join("\n\n");
}

export function buildAnalysisPrompt(input: {
  task: AiTask;
  question: string | null;
  paper: PaperHeader;
  source: SourceKind;
  coverage: Coverage;
  excerpts: Excerpt[];
}): string {
  const header = [
    `Paper title: ${input.paper.title}`,
    input.paper.authors.length ? `Authors: ${input.paper.authors.slice(0, 10).join(", ")}` : null,
    input.paper.year ? `Year: ${input.paper.year}` : null,
    `Available content: ${describeSource(input.source, input.coverage)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const question = input.task === "question" && input.question ? `\nUser question: """${input.question}"""\n` : "";
  return `${header}

Task: ${TASK_INSTRUCTIONS[input.task]}
${question}
Excerpts:
${formatExcerpts(input.excerpts)}`;
}

// ---- Comparison ----

export const COMPARISON_FIELDS = [
  "problem",
  "method",
  "contribution",
  "datasets",
  "baselines",
  "metrics",
  "findings",
  "limitations",
  "gaps",
] as const;
export type ComparisonField = (typeof COMPARISON_FIELDS)[number];

export const COMPARISON_FIELD_LABELS: Record<ComparisonField, string> = {
  problem: "Research problem",
  method: "Method",
  contribution: "Claimed contribution",
  datasets: "Datasets",
  baselines: "Baselines",
  metrics: "Evaluation metrics",
  findings: "Main experimental findings",
  limitations: "Limitations",
  gaps: "Potential research gaps",
};

export const COMPARISON_SYSTEM_PROMPT = `You compare scientific papers for a researcher.
Use ONLY the excerpts supplied for each paper. For each field, write a concise value (max ~60 words) or null if the paper's excerpts do not report it.
Never invent numeric results: include numbers only if they appear verbatim in that paper's excerpts.
"gaps" is your interpretation of open problems and must be phrased as such.
Respond with a single JSON object:
{
  "papers": [ { "paper_id": "P1", "fields": { ${COMPARISON_FIELDS.map((f) => `"${f}": { "value": string | null, "evidence": ["E1"] }`).join(", ")} } } ],
  "synthesis": string | null
}
"synthesis" is a short cross-paper comparison (max 120 words), clearly an interpretation.`;

export interface ComparePaperInput {
  ref: string;
  paper: PaperHeader;
  source: SourceKind;
  excerpts: Excerpt[];
}

export function buildComparisonPrompt(papers: ComparePaperInput[]): string {
  return papers
    .map((p) => {
      const kind = p.source === "fulltext" ? "selected full-text excerpts" : p.source === "abstract" ? "abstract only" : "metadata only";
      return `=== ${p.ref}: ${p.paper.title}${p.paper.year ? ` (${p.paper.year})` : ""} — ${kind} ===\n${
        p.excerpts.length ? formatExcerpts(p.excerpts) : "(no text available)"
      }`;
    })
    .join("\n\n");
}

// ---- Study materials ----

export const STUDY_SYSTEM_PROMPT = `You create study materials from a scientific paper for a student.
Use ONLY facts stated in the supplied excerpts. Every card and question must cite the excerpt id it is based on.
Questions must be answerable from the excerpts. Exactly one option is correct; distractors must be plausible but clearly wrong according to the excerpts.
Respond with a single JSON object:
{
  "flashcards": [ { "front": string, "back": string, "type": "concept" | "term", "evidence_id": "E1" } ],
  "questions": [ { "question": string, "options": [string, string, string, string], "answer_index": 0, "explanation": string, "evidence_id": "E1" } ]
}
Produce 6-10 flashcards and 5-8 questions, fewer if the excerpts are short.`;

export function buildStudyPrompt(paper: PaperHeader, source: SourceKind, excerpts: Excerpt[]): string {
  return `Paper title: ${paper.title}
Content: ${source === "fulltext" ? "selected excerpts from the full text" : "abstract only"}

Excerpts:
${formatExcerpts(excerpts)}`;
}
