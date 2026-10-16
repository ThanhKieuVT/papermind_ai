import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { AI_TASKS, LIMITS, coverageSchema, excerptSchema, type Excerpt } from "@/lib/ai/types";

const paperHeaderSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.maxTitleChars),
  authors: z.array(z.string().max(200)).max(100).default([]),
  year: z.number().int().min(1500).max(2100).nullable().default(null),
});

const sourceSchema = z.enum(["fulltext", "abstract", "metadata"]);

function totalChars(excerpts: Excerpt[]): number {
  return excerpts.reduce((s, e) => s + e.text.length, 0);
}

function uniqueIds(excerpts: Excerpt[]): boolean {
  return new Set(excerpts.map((e) => e.id)).size === excerpts.length;
}

export const analyzeRequestSchema = z
  .object({
    task: z.enum(AI_TASKS),
    question: z.string().trim().max(LIMITS.maxQuestionChars).nullable().default(null),
    paper: paperHeaderSchema,
    source: sourceSchema,
    coverage: coverageSchema,
    excerpts: z.array(excerptSchema).min(1, "No paper text was provided.").max(LIMITS.maxExcerpts),
  })
  .refine((v) => v.task !== "question" || (v.question && v.question.length >= 3), {
    message: "Please enter a question (at least 3 characters).",
  })
  .refine((v) => totalChars(v.excerpts) <= LIMITS.maxContextChars, { message: "The supplied paper context is too large." })
  .refine((v) => uniqueIds(v.excerpts), { message: "Excerpt ids must be unique." });
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export const compareRequestSchema = z
  .object({
    papers: z
      .array(
        z.object({
          paperId: z.string().min(1).max(200),
          paper: paperHeaderSchema,
          source: sourceSchema,
          excerpts: z.array(excerptSchema).max(LIMITS.maxExcerpts),
        }),
      )
      .min(2, "Select at least 2 papers.")
      .max(5, "Select at most 5 papers."),
  })
  .refine((v) => v.papers.reduce((s, p) => s + totalChars(p.excerpts), 0) <= LIMITS.maxCompareContextChars, {
    message: "The selected papers contain too much text to compare at once.",
  })
  .refine((v) => v.papers.every((p) => uniqueIds(p.excerpts)), { message: "Excerpt ids must be unique per paper." });
export type CompareRequest = z.infer<typeof compareRequestSchema>;

export const studyRequestSchema = z
  .object({
    paperId: z.string().min(1).max(200),
    paper: paperHeaderSchema,
    source: z.enum(["fulltext", "abstract"]),
    excerpts: z.array(excerptSchema).min(1).max(LIMITS.maxExcerpts),
  })
  .refine((v) => totalChars(v.excerpts) <= LIMITS.maxContextChars, { message: "The supplied paper context is too large." })
  .refine((v) => uniqueIds(v.excerpts), { message: "Excerpt ids must be unique." });
export type StudyRequest = z.infer<typeof studyRequestSchema>;

/** Byte limit for AI request bodies (well under Vercel's 4.5 MB function payload limit). */
export const MAX_AI_BODY_BYTES = 400_000;

export function parseOrThrow<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError("invalid_input", issue?.message && issue.message !== "Required" ? issue.message : "Invalid request.");
  }
  return result.data;
}
