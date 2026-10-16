import type { PageText } from "@/types/paper";
import type { AiTask, Coverage, Excerpt } from "@/lib/ai/types";
import { LIMITS } from "@/lib/ai/types";

export interface Chunk {
  page: number;
  index: number;
  text: string;
}

const DEFAULT_CHUNK_CHARS = 1800;

/** Splits page text into chunks that never span pages, breaking on paragraph or sentence boundaries. */
export function chunkPages(pages: PageText[], maxChars = DEFAULT_CHUNK_CHARS): Chunk[] {
  const chunks: Chunk[] = [];
  let index = 0;
  for (const { page, text } of pages) {
    const clean = text.trim();
    if (!clean) continue;
    const pieces = clean.split(/\n\s*\n|(?<=[.!?])\s+/);
    let current = "";
    const flush = () => {
      if (current.trim()) chunks.push({ page, index: index++, text: current.trim() });
      current = "";
    };
    for (const piece of pieces) {
      if (piece.length > maxChars) {
        flush();
        for (let i = 0; i < piece.length; i += maxChars) {
          chunks.push({ page, index: index++, text: piece.slice(i, i + maxChars).trim() });
        }
        continue;
      }
      if (current.length + piece.length + 1 > maxChars) flush();
      current += (current ? " " : "") + piece;
    }
    flush();
  }
  return chunks;
}

const STOPWORDS = new Set(
  "a an and are as at be but by can do does for from has have how in is it its of on or that the their this to was we what when where which while who why will with you your our these those there than then into about paper".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

/** Keywords that tend to occur in passages relevant to each task. */
const TASK_HINTS: Record<AiTask, string> = {
  summary: "abstract introduction propose contribution results conclusion",
  problem: "problem task challenge address goal objective introduction",
  motivation: "motivation however limitation existing prior gap lack challenge",
  contributions: "contribution contributions propose novel introduce first we present",
  methodology: "method approach model architecture algorithm framework training objective loss procedure",
  terms: "define definition denote refer called term",
  equations: "equation denote loss objective function where defined",
  experiments: "dataset datasets benchmark baseline baselines metric metrics evaluation accuracy experiment results table",
  limitations: "limitation limitations future work fail failure however drawback restricted assume",
  question: "",
};

const MATH_PATTERN = /[=∑∏∫√≤≥≈∈∀∃λσμθαβγ]|\\(frac|sum|log)/;

function scoreChunks(chunks: Chunk[], query: string, task: AiTask): number[] {
  const queryTerms = [...new Set(tokenize(`${query} ${TASK_HINTS[task]}`))];
  if (queryTerms.length === 0) return chunks.map(() => 0);
  const docFreq = new Map<string, number>();
  const chunkTerms = chunks.map((c) => {
    const terms = tokenize(c.text);
    new Set(terms).forEach((t) => docFreq.set(t, (docFreq.get(t) ?? 0) + 1));
    return terms;
  });
  const n = chunks.length;
  return chunkTerms.map((terms, i) => {
    const tf = new Map<string, number>();
    terms.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    let score = 0;
    for (const q of queryTerms) {
      const f = tf.get(q);
      if (!f) continue;
      const idf = Math.log(1 + n / (docFreq.get(q) ?? 1));
      score += (f / (f + 1.2)) * idf;
    }
    if (task === "equations" && MATH_PATTERN.test(chunks[i]?.text ?? "")) score += 2;
    return score;
  });
}

export interface SelectedContext {
  excerpts: Excerpt[];
  coverage: Coverage;
}

/**
 * Picks chunks that fit within the character budget. When the whole paper fits,
 * everything is sent and coverage is marked complete. Otherwise the opening chunks
 * (abstract/introduction) plus the best-scoring chunks are sent, and coverage
 * honestly reports what was left out.
 */
export function selectContext(
  chunks: Chunk[],
  opts: { task: AiTask; query?: string; budgetChars?: number; totalPages: number | null },
): SelectedContext {
  const budget = Math.min(opts.budgetChars ?? LIMITS.maxContextChars, LIMITS.maxContextChars);
  const maxCount = LIMITS.maxExcerpts;
  const totalChars = chunks.reduce((s, c) => s + c.text.length, 0);

  let picked: Chunk[];
  if (totalChars <= budget && chunks.length <= maxCount) {
    picked = chunks;
  } else {
    const scores = scoreChunks(chunks, opts.query ?? "", opts.task);
    const leadCount = opts.task === "summary" || opts.task === "problem" || opts.task === "contributions" ? 4 : 2;
    const order = [
      ...chunks.slice(0, leadCount).map((_, i) => i),
      ...chunks
        .map((_, i) => i)
        .slice(leadCount)
        .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0)),
    ];
    const chosen = new Set<number>();
    let used = 0;
    for (const i of order) {
      const c = chunks[i];
      if (!c || chosen.size >= maxCount) continue;
      if (used + c.text.length > budget) continue;
      chosen.add(i);
      used += c.text.length;
    }
    picked = chunks.filter((_, i) => chosen.has(i));
  }

  const excerpts: Excerpt[] = picked.map((c, i) => ({
    id: `E${i + 1}`,
    page: c.page,
    text: c.text.slice(0, LIMITS.maxExcerptChars),
  }));
  const pagesIncluded = [...new Set(picked.map((c) => c.page))].sort((a, b) => a - b);
  return {
    excerpts,
    coverage: {
      pagesIncluded,
      totalPages: opts.totalPages,
      selectedChunks: picked.length,
      totalChunks: chunks.length,
      complete: picked.length === chunks.length,
    },
  };
}

/** Builds context from an abstract only (no full text available). */
export function abstractContext(abstract: string): SelectedContext {
  const text = abstract.slice(0, LIMITS.maxExcerptChars);
  return {
    excerpts: [{ id: "E1", page: null, text }],
    coverage: {
      pagesIncluded: [],
      totalPages: null,
      selectedChunks: 1,
      totalChunks: 1,
      complete: abstract.length <= LIMITS.maxExcerptChars,
    },
  };
}
