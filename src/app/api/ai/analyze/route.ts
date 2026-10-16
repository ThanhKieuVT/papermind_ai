import { NextResponse } from "next/server";
import { toErrorBody } from "@/lib/api/errors";
import { authorizeAiRequest, readJsonBody } from "@/lib/ai/guard";
import { parseAnalysis } from "@/lib/ai/parse";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "@/lib/ai/prompts";
import type { AnalysisResult } from "@/lib/ai/types";
import { MAX_AI_BODY_BYTES, analyzeRequestSchema, parseOrThrow } from "@/lib/validation/ai";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const provider = authorizeAiRequest(request.headers);
    const input = parseOrThrow(analyzeRequestSchema, await readJsonBody(request, MAX_AI_BODY_BYTES));
    const text = await provider.generateJson({
      system: ANALYSIS_SYSTEM_PROMPT,
      prompt: buildAnalysisPrompt(input),
    });
    const parsed = parseAnalysis(text, input.excerpts);
    const result: AnalysisResult = {
      task: input.task,
      ...parsed,
      source: input.source,
      coverage: input.coverage,
      model: provider.model,
    };
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const { body, status } = toErrorBody(error);
    return NextResponse.json(body, { status });
  }
}
