import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { GeminiProvider, getAiProvider, type AiProvider } from "@/lib/ai/provider";

export const ACCESS_HEADER = "x-papermind-access";
/** Header carrying a visitor's own Gemini key ("bring your own key"). Never logged or stored server-side. */
export const USER_KEY_HEADER = "x-user-gemini-key";

export interface AiStatus {
  enabled: boolean;
  /** True when the client must supply an access token. */
  requiresToken: boolean;
  model: string | null;
  reason: string | null;
  /** True when visitors may use AI with their own Gemini key. */
  userKeyAllowed: boolean;
}

function userKeysAllowed(env: NodeJS.ProcessEnv): boolean {
  return env.AI_ALLOW_USER_KEYS !== "false";
}

/** Loose format check so obviously invalid values are rejected before calling the provider. */
export function isPlausibleGeminiKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{30,80}$/.test(key);
}

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production";
}

/** Describes whether AI is usable on this deployment, without revealing secrets. */
export function getAiStatus(env: NodeJS.ProcessEnv = process.env): AiStatus {
  const provider = getAiProvider(env);
  const userKeyAllowed = userKeysAllowed(env);
  if (!provider) {
    return { enabled: false, requiresToken: false, model: null, reason: "No AI provider is configured (GEMINI_API_KEY is not set).", userKeyAllowed };
  }
  const token = env.AI_ACCESS_TOKEN?.trim();
  if (token) return { enabled: true, requiresToken: true, model: provider.model, reason: null, userKeyAllowed };
  if (isProduction(env) && env.AI_ALLOW_PUBLIC !== "true") {
    return {
      enabled: false,
      requiresToken: false,
      model: provider.model,
      reason: "AI is disabled on this deployment until the administrator sets AI_ACCESS_TOKEN (or explicitly AI_ALLOW_PUBLIC=true).",
      userKeyAllowed,
    };
  }
  return { enabled: true, requiresToken: false, model: provider.model, reason: null, userKeyAllowed };
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
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";

  // A visitor's own key takes precedence: it costs the site owner nothing.
  const userKey = headers.get(USER_KEY_HEADER)?.trim();
  if (userKey) {
    if (!userKeysAllowed(env)) throw new ApiError("unauthorized", "This site does not accept personal API keys.");
    if (!isPlausibleGeminiKey(userKey)) throw new ApiError("invalid_input", "That doesn't look like a Gemini API key. Check it in Settings.");
    checkRateLimit(ip);
    return new GeminiProvider({ apiKey: userKey, model: env.GEMINI_MODEL?.trim() || undefined });
  }

  const status = getAiStatus(env);
  const provider = getAiProvider(env);
  if (!status.enabled || !provider) throw new ApiError("ai_disabled", status.reason ?? "AI is disabled.");

  if (status.requiresToken) {
    const supplied = headers.get(ACCESS_HEADER)?.trim() ?? "";
    if (!supplied || !tokensMatch(supplied, env.AI_ACCESS_TOKEN?.trim() ?? "")) {
      throw new ApiError("unauthorized", "A valid access code is required, or use your own Gemini key.");
    }
  }
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
