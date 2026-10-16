import type { PageText } from "@/types/paper";
import type { Flashcard, QuizQuestion } from "@/lib/study/types";

/**
 * Rule-based (non-AI) study material generation. It only extracts what is literally
 * present in the text: acronym definitions like "Long Short-Term Memory (LSTM)" and
 * explicit definitions like "X is defined as ...". Results are labelled "rule-based".
 */

interface Definition {
  term: string;
  definition: string;
  page: number | null;
}

function initialsMatch(expansion: string, acronym: string): boolean {
  const words = expansion.split(/[\s-]+/).filter((w) => /^[A-Za-z]/.test(w));
  const initials = words.map((w) => w[0]?.toUpperCase() ?? "").join("");
  const acr = acronym.replace(/s$/, "").toUpperCase();
  // allow lowercase function words (of, and, for) to be skipped
  const significant = words.filter((w) => !/^(of|and|for|the|in|on|with|to|a|an)$/i.test(w)).map((w) => w[0]?.toUpperCase()).join("");
  return initials.endsWith(acr) || significant.endsWith(acr);
}

export function extractAcronyms(pages: PageText[]): Definition[] {
  const found = new Map<string, Definition>();
  const pattern = /((?:[A-Za-z][\w-]*\s+){1,7}?[A-Za-z][\w-]*)\s+\(([A-Z][A-Za-z0-9]{1,9}s?)\)/g;
  for (const { page, text } of pages) {
    const flat = text.replace(/\s+/g, " ");
    for (const m of flat.matchAll(pattern)) {
      const acronym = m[2];
      const words = (m[1] ?? "").trim().split(" ");
      if (!acronym || !/[A-Z].*[A-Z]/.test(acronym)) continue;
      // Find the shortest suffix of the preceding words whose initials match the acronym.
      for (let start = words.length - 1; start >= 0; start--) {
        const expansion = words.slice(start).join(" ");
        if (initialsMatch(expansion, acronym)) {
          if (!found.has(acronym)) found.set(acronym, { term: acronym, definition: expansion, page });
          break;
        }
      }
    }
  }
  return [...found.values()];
}

export function extractDefinitions(pages: PageText[]): Definition[] {
  const out: Definition[] = [];
  const pattern =
    /(?:^|[.;]\s+)(?:We define |We call |We refer to )?([A-Z][\w-]*(?:\s+[\w-]+){0,4}?)\s+(?:is defined as|is referred to as|refers to|denotes)\s+([^.;]{15,220})[.;]/g;
  for (const { page, text } of pages) {
    const flat = text.replace(/\s+/g, " ");
    for (const m of flat.matchAll(pattern)) {
      const term = m[1]?.trim();
      const definition = m[2]?.trim();
      if (term && definition && term.length <= 60) out.push({ term, definition, page });
    }
  }
  const seen = new Set<string>();
  return out.filter((d) => (seen.has(d.term.toLowerCase()) ? false : (seen.add(d.term.toLowerCase()), true)));
}

function shuffleDeterministic<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}

export interface RuleBasedResult {
  flashcards: Flashcard[];
  questions: QuizQuestion[];
}

export function generateRuleBasedStudy(pages: PageText[], idPrefix = "rb"): RuleBasedResult {
  const acronyms = extractAcronyms(pages).slice(0, 20);
  const definitions = extractDefinitions(pages).slice(0, 15);

  const flashcards: Flashcard[] = [
    ...acronyms.map((a, i) => ({
      id: `${idPrefix}-acr-${i}`,
      front: `What does ${a.term} stand for?`,
      back: a.definition,
      type: "term" as const,
      origin: "rule-based" as const,
      page: a.page,
    })),
    ...definitions.map((d, i) => ({
      id: `${idPrefix}-def-${i}`,
      front: d.term,
      back: d.definition,
      type: "concept" as const,
      origin: "rule-based" as const,
      page: d.page,
    })),
  ];

  // Multiple-choice: acronym -> expansion, with other expansions as distractors (needs >= 4 acronyms).
  const questions: QuizQuestion[] = [];
  if (acronyms.length >= 4) {
    acronyms.slice(0, 10).forEach((a, i) => {
      const distractors = shuffleDeterministic(acronyms.filter((o) => o.term !== a.term), i + 7)
        .slice(0, 3)
        .map((o) => o.definition);
      const options = shuffleDeterministic([a.definition, ...distractors], i + 13);
      questions.push({
        id: `${idPrefix}-q-${i}`,
        question: `In this paper, what does "${a.term}" stand for?`,
        options,
        answerIndex: options.indexOf(a.definition),
        explanation: `The paper introduces ${a.term} as "${a.definition}"${a.page ? ` (page ${a.page})` : ""}.`,
        origin: "rule-based",
        page: a.page,
      });
    });
  }
  return { flashcards, questions };
}
