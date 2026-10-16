import { NextResponse, type NextRequest } from "next/server";
import { toErrorBody } from "@/lib/api/errors";
import { getOpenAlexWork, openAlexOptionsFromEnv } from "@/lib/api/openalex";

export const maxDuration = 20;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const paper = await getOpenAlexWork(id, openAlexOptionsFromEnv());
    return NextResponse.json({ paper }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    const { body, status } = toErrorBody(error);
    return NextResponse.json(body, { status });
  }
}
