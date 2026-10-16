import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { getAiProvider, type AiProvider } from "@/lib/ai/provider";

export const ACCESS_HEADER = "x-papermind-access";

export interface AiStatus {
  enabled: boolean;
  /** True when the client must supply an access token. */
  requiresToken: boolean;
  model: string | null;
  reason: string | null;
}

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production";
}

/** Describes whether AI is usable on this deployment, without revealing secrets. */
export function getAiStatus(env: NodeJS.ProcessEnv = process.env): AiStatus {
  const provider = getAiProvider(env);
  if (!provider) {
    return { enabled: false, requiresToken: false, model: null, reason: "No AI provider is configured (GEMINI_API_KEY is not set)." };
  }
  const token = env.AI_ACCESS_TOKEN?.trim();
  if (token) return { enabled: true, requiresToken: true, model: provider.model, reason: null };
  if (isProduction(env) && env.AI_ALLOW_PUBLIC !== "true") {
    return {
      enabled: false,
      requiresToken: false,
      model: provider.model,
      reason: "AI is disabled on this deployment until the administrator sets AI_ACCESS_TOKEN (or explicitly AI_ALLOW_PUBLIC=true).",
    };
  }
  return { enabled: true, requiresToken: false, model: provider.model, reason: null };
}

function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Best-effort, per-instance sliding window. Serverless instances do not share memory,
// so this limits bursts but is not a global quota (documented in docs/DEPLOYMENT.md).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, now = Date.now()): void {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    hits.set(key, recent);
    throw new ApiError("rate_limited", "Too many AI requests. Please wait a few minutes and try again.");
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
}

export function resetRateLimits(): void {
  hits.clear();
}

/** Throws an ApiError unless the request may use AI; returns the provider otherwise. */
export function authorizeAiRequest(headers: Headers, env: NodeJS.ProcessEnv = process.env): AiProvider {
  const status = getAiStatus(env);
  const provider = getAiProvider(env);
  if (!status.enabled || !provider) throw new ApiError("ai_disabled", status.reason ?? "AI is disabled.");

  if (status.requiresToken) {
    const supplied = headers.get(ACCESS_HEADER)?.trim() ?? "";
    if (!supplied || !tokensMatch(supplied, env.AI_ACCESS_TOKEN?.trim() ?? "")) {
      throw new ApiError("unauthorized", "A valid AI access token is required. Enter it in Settings.");
    }
  }
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
  checkRateLimit(ip);
  return provider;
}

/** Reads and size-checks a JSON body before parsing. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new ApiError("payload_too_large", "The request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiError("payload_too_large", "The request is too large.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("invalid_input", "The request body must be valid JSON.");
  }
}
