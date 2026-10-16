import { z } from "zod";
import type { SearchParams } from "@/types/paper";
import { ApiError } from "@/lib/api/errors";

export const MAX_QUERY_LENGTH = 300;
const currentYear = new Date().getFullYear();

const yearSchema = z.coerce.number().int().min(1500).max(currentYear + 1);

const searchQuerySchema = z
  .object({
    q: z.string().trim().min(2, "Enter at least 2 characters.").max(MAX_QUERY_LENGTH, "Query is too long."),
    page: z.coerce.number().int().min(1).max(50).default(1),
    perPage: z.coerce.number().int().min(5).max(50).default(10),
    sort: z.enum(["relevance", "cited_by_count", "publication_year"]).default("relevance"),
    yearFrom: yearSchema.optional(),
    yearTo: yearSchema.optional(),
    oa: z.enum(["true", "false"]).optional(),
  })
  .refine((v) => !v.yearFrom || !v.yearTo || v.yearFrom <= v.yearTo, {
    message: "'From' year must not be after 'To' year.",
  });

/** Parses URL search params into validated SearchParams or throws an ApiError. */
export function parseSearchParams(input: URLSearchParams): SearchParams {
  const raw: Record<string, string> = {};
  for (const [k, v] of input.entries()) if (v !== "") raw[k] = v;
  const result = searchQuerySchema.safeParse(raw);
  if (!result.success) {
    throw new ApiError("invalid_input", result.error.issues[0]?.message ?? "Invalid search parameters.");
  }
  const v = result.data;
  return {
    query: v.q,
    page: v.page,
    perPage: v.perPage,
    sort: v.sort,
    yearFrom: v.yearFrom ?? null,
    yearTo: v.yearTo ?? null,
    openAccessOnly: v.oa === "true",
  };
}
