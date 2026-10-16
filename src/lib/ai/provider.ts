import { ApiError } from "@/lib/api/errors";

export interface GenerateRequest {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}

/** Provider-agnostic interface; responses are expected to be a JSON document as text. */
export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateJson(request: GenerateRequest): Promise<string>;
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

interface GeminiErrorBody {
  error?: { message?: string; status?: string; details?: { reason?: string }[] };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;

  constructor(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch; timeoutMs?: number; retryDelayMs?: number }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model || DEFAULT_GEMINI_MODEL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 50_000;
    this.retryDelayMs = opts.retryDelayMs ?? 1500;
  }

  async generateJson(request: GenerateRequest): Promise<string> {
    const started = Date.now();
    let response = await this.send(request);
    // Gemini returns 500/503 when briefly overloaded; one quick retry usually succeeds.
    // Only retry fast failures so both attempts fit within the 60 s function limit.
    const failedFast = Date.now() - started < 8_000;
    if ((response.status === 500 || response.status === 503) && failedFast) {
      await new Promise((r) => setTimeout(r, this.retryDelayMs));
      response = await this.send(request);
    }
    return this.readResponse(response);
  }

  private async send(request: GenerateRequest): Promise<Response> {
    const url = `${GEMINI_BASE}/${encodeURIComponent(this.model)}:generateContent`;
    try {
      return await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: {
            temperature: request.temperature ?? 0.2,
            maxOutputTokens: request.maxOutputTokens ?? 8192,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new ApiError(
        "network_error",
        timedOut ? "The AI provider took too long to respond. Try a shorter request." : "Could not reach the AI provider.",
      );
    }
  }

  private async readResponse(response: Response): Promise<string> {
    if (!response.ok) throw await mapGeminiError(response);

    let data: GeminiResponse;
    try {
      data = (await response.json()) as GeminiResponse;
    } catch {
      throw new ApiError("bad_ai_response", "The AI provider returned an unreadable response.");
    }
    if (data.promptFeedback?.blockReason) {
      throw new ApiError("bad_ai_response", "The AI provider declined to process this content.");
    }
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new ApiError("bad_ai_response", "The AI response was cut off because it was too long. Try a narrower request.");
    }
    if (!text.trim()) throw new ApiError("bad_ai_response", "The AI provider returned an empty response.");
    return text;
  }
}

async function mapGeminiError(response: Response): Promise<ApiError> {
  let body: GeminiErrorBody = {};
  try {
    body = (await response.json()) as GeminiErrorBody;
  } catch {
    // ignore unparsable error bodies
  }
  const reason = body.error?.details?.find((d) => d.reason)?.reason ?? "";
  if (reason === "API_KEY_INVALID" || response.status === 401 || response.status === 403) {
    return new ApiError("ai_disabled", "The Gemini API key was rejected by Google. If you entered your own key, check it in Settings; otherwise ask the site owner to check GEMINI_API_KEY.");
  }
  if (response.status === 429) {
    return new ApiError("rate_limited", "The AI provider's rate limit or quota was reached. Please wait and try again.");
  }
  if (response.status === 404) {
    return new ApiError("ai_disabled", "The configured AI model is not available. Check GEMINI_MODEL.");
  }
  if (response.status === 400) {
    return new ApiError("invalid_input", "The AI provider rejected the request (it may be too large).");
  }
  if (response.status === 500 || response.status === 503) {
    return new ApiError("upstream_error", "The AI provider is temporarily overloaded. Please try again in a moment.");
  }
  return new ApiError("upstream_error", `The AI provider returned an error (HTTP ${response.status}).`);
}

/** Returns the configured provider, or null when no credentials are configured. */
export function getAiProvider(env: NodeJS.ProcessEnv = process.env): AiProvider | null {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GeminiProvider({ apiKey, model: env.GEMINI_MODEL?.trim() || undefined });
}
