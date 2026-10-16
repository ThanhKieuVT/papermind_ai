import { NextResponse, type NextRequest } from "next/server";
import { toErrorBody } from "@/lib/api/errors";
import { openAlexOptionsFromEnv, searchOpenAlex } from "@/lib/api/openalex";
import { parseSearchParams } from "@/lib/validation/search";

export const maxDuration = 20;

export async function GET(request: NextRequest) {
  try {
    const params = parseSearchParams(request.nextUrl.searchParams);
    const result = await searchOpenAlex(params, openAlexOptionsFromEnv());
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  } catch (error) {
    const { body, status } = toErrorBody(error);
    return NextResponse.json(body, { status });
  }
}
