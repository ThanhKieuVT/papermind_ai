import { NextResponse } from "next/server";
import { toErrorBody } from "@/lib/api/errors";
import { authorizeAiRequest, readJsonBody } from "@/lib/ai/guard";
import { STUDY_SYSTEM_PROMPT, buildStudyPrompt } from "@/lib/ai/prompts";
import { parseStudy } from "@/lib/study/parse";
import { MAX_AI_BODY_BYTES, parseOrThrow, studyRequestSchema } from "@/lib/validation/ai";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const provider = authorizeAiRequest(request.headers);
    const input = parseOrThrow(studyRequestSchema, await readJsonBody(request, MAX_AI_BODY_BYTES));
    const text = await provider.generateJson({
      system: STUDY_SYSTEM_PROMPT,
      prompt: buildStudyPrompt(input.paper, input.source, input.excerpts),
      temperature: 0.4,
    });
    const result = parseStudy(text, input.excerpts, `ai-${Date.now().toString(36)}`);
    return NextResponse.json({ ...result, model: provider.model }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const { body, status } = toErrorBody(error);
    return NextResponse.json(body, { status });
  }
}
