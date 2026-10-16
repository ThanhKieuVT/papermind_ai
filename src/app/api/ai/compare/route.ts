import { NextResponse } from "next/server";
import { toErrorBody } from "@/lib/api/errors";
import { authorizeAiRequest, readJsonBody } from "@/lib/ai/guard";
import { COMPARISON_SYSTEM_PROMPT, buildComparisonPrompt } from "@/lib/ai/prompts";
import { parseComparison, type CompareInputPaper } from "@/lib/compare/comparison";
import { MAX_AI_BODY_BYTES, compareRequestSchema, parseOrThrow } from "@/lib/validation/ai";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const provider = authorizeAiRequest(request.headers);
    const input = parseOrThrow(compareRequestSchema, await readJsonBody(request, MAX_AI_BODY_BYTES));
    const papers: CompareInputPaper[] = input.papers.map((p, i) => ({
      ref: `P${i + 1}`,
      paperId: p.paperId,
      title: p.paper.title,
      year: p.paper.year,
      source: p.excerpts.length ? p.source : "metadata",
      excerpts: p.excerpts,
    }));
    const text = await provider.generateJson({
      system: COMPARISON_SYSTEM_PROMPT,
      prompt: buildComparisonPrompt(papers.map((p, i) => ({ ...p, paper: input.papers[i]!.paper }))),
    });
    return NextResponse.json(parseComparison(text, papers, provider.model), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const { body, status } = toErrorBody(error);
    return NextResponse.json(body, { status });
  }
}
