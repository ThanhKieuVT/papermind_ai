import { LIMITS } from "@/lib/ai/types";

/** Retrieval query used to pick the passages most useful for a comparison table. */
export const LIBRARY_COMPARE_QUERY =
  "problem method approach contribution dataset benchmark baseline metric evaluation results accuracy limitation future work";

/** Splits the comparison context budget evenly between papers. */
export function compareBudgetPerPaper(paperCount: number): number {
  return Math.floor(LIMITS.maxCompareContextChars / Math.max(paperCount, 1));
}
