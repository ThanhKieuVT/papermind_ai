import { NextResponse } from "next/server";
import { getAiStatus } from "@/lib/ai/guard";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getAiStatus(), { headers: { "Cache-Control": "no-store" } });
}
