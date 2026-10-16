import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { extractJson } from "@/lib/ai/parse";
import type { Excerpt } from "@/lib/ai/types";
import type { Flashcard, QuizQuestion } from "@/lib/study/types";

const rawStudySchema = z.object({
  flashcards: z
    .array(
      z.object({
        front: z.string().min(1).max(500),
        back: z.string().min(1).max(1500),
        type: z.string().optional(),
        evidence_id: z.string().nullish(),
      }),
    )
    .default([]),
  questions: z
    .array(
      z.object({
        question: z.string().min(1).max(800),
        options: z.array(z.string().min(1).max(400)).min(2).max(6),
        answer_index: z.number().int(),
        explanation: z.string().max(1500).default(""),
        evidence_id: z.string().nullish(),
      }),
    )
    .default([]),
});

export interface ParsedStudy {
  flashcards: Flashcard[];
  questions: QuizQuestion[];
  /** Items dropped because they were malformed or cited no supplied excerpt. */
  discarded: number;
}

export function parseStudy(text: string, excerpts: Excerpt[], idPrefix: string): ParsedStudy {
  const parsed = rawStudySchema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new ApiError("bad_ai_response", "The AI study materials did not match the expected format. Please try again.");
  }
  const pages = new Map(excerpts.map((e) => [e.id, e.page]));
  let discarded = 0;

  const flashcards: Flashcard[] = [];
  parsed.data.flashcards.forEach((c, i) => {
    const id = c.evidence_id?.trim().toUpperCase() ?? "";
    if (!pages.has(id)) {
      discarded++;
      return;
    }
    flashcards.push({
      id: `${idPrefix}-fc-${i}`,
      front: c.front.trim(),
      back: c.back.trim(),
      type: c.type === "term" ? "term" : "concept",
      origin: "ai",
      page: pages.get(id) ?? null,
    });
  });

  const questions: QuizQuestion[] = [];
  parsed.data.questions.forEach((q, i) => {
    const id = q.evidence_id?.trim().toUpperCase() ?? "";
    const uniqueOptions = new Set(q.options.map((o) => o.trim().toLowerCase()));
    if (!pages.has(id) || q.answer_index < 0 || q.answer_index >= q.options.length || uniqueOptions.size !== q.options.length) {
      discarded++;
      return;
    }
    questions.push({
      id: `${idPrefix}-q-${i}`,
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()),
      answerIndex: q.answer_index,
      explanation: q.explanation.trim(),
      origin: "ai",
      page: pages.get(id) ?? null,
    });
  });

  return { flashcards, questions, discarded };
}
