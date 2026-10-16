import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseAnalysis, extractJson, quoteAppearsIn } from "@/lib/ai/parse";
import { authorizeAiRequest, checkRateLimit, getAiStatus, resetRateLimits } from "@/lib/ai/guard";
import { GeminiProvider, getAiProvider } from "@/lib/ai/provider";
import { abstractContext, chunkPages, selectContext } from "@/lib/ai/chunking";
import { buildAnalysisPrompt } from "@/lib/ai/prompts";
import type { Excerpt } from "@/lib/ai/types";

const excerpts: Excerpt[] = [
  { id: "E1", page: 1, text: "We introduce the Transformer, a model architecture relying entirely on attention mechanisms." },
  { id: "E2", page: 7, text: "Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task." },
];

function env(vars: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...vars } as NodeJS.ProcessEnv;
}

describe("AI response parsing and grounding", () => {
  it("keeps verified quotes with page numbers derived from excerpts", () => {
    const text = JSON.stringify({
      status: "supported",
      sections: [
        {
          heading: "Results",
          statements: [
            { text: "It reaches 28.4 BLEU.", kind: "paper", evidence: [{ excerpt_id: "E2", quote: "achieves 28.4 BLEU on the WMT 2014" }] },
          ],
        },
      ],
      insufficient_context_note: null,
    });
    const parsed = parseAnalysis(text, excerpts);
    const st = parsed.sections[0]!.statements[0]!;
    expect(st.kind).toBe("paper");
    expect(st.evidence).toEqual([{ excerptId: "E2", page: 7, quote: "achieves 28.4 BLEU on the WMT 2014", quoteVerified: true }]);
  });

  it("drops fabricated quotes and references to excerpts that were never supplied", () => {
    const text = JSON.stringify({
      status: "supported",
      sections: [
        {
          heading: "Claims",
          statements: [
            { text: "Fabricated quote", kind: "paper", evidence: [{ excerpt_id: "E1", quote: "we achieve state of the art on ImageNet" }] },
            { text: "Fake excerpt", kind: "paper", evidence: [{ excerpt_id: "E99", quote: null }] },
          ],
        },
      ],
    });
    const [a, b] = parseAnalysis(text, excerpts).sections[0]!.statements;
    expect(a!.evidence[0]).toMatchObject({ excerptId: "E1", quote: null, quoteVerified: false });
    expect(a!.kind).toBe("paper");
    // "paper" claim with no valid evidence is downgraded
    expect(b!.evidence).toEqual([]);
    expect(b!.kind).toBe("interpretation");
  });

  it("strips evidence from background statements and normalizes unknown kinds/status", () => {
    const text = "```json\n" + JSON.stringify({
      status: "weird",
      sections: [{ heading: "", statements: [
        { text: "Attention is a weighting mechanism.", kind: "background", evidence: [{ excerpt_id: "E1", quote: null }] },
        { text: "Maybe", kind: "guess" },
      ] }],
      insufficient_context_note: "The excerpts do not describe training time.",
    }) + "\n```";
    const parsed = parseAnalysis(text, excerpts);
    expect(parsed.status).toBe("partially_supported");
    expect(parsed.sections[0]!.heading).toBe("Answer");
    expect(parsed.sections[0]!.statements[0]!.evidence).toEqual([]);
    expect(parsed.sections[0]!.statements[1]!.kind).toBe("interpretation");
    expect(parsed.insufficientContextNote).toMatch(/training time/);
  });

  it("rejects unparsable or schema-invalid output", () => {
    expect(() => parseAnalysis("I cannot answer that", excerpts)).toThrow(/could not be parsed/);
    expect(() => parseAnalysis(JSON.stringify({ foo: 1 }), excerpts)).toThrow(/expected format/);
  });

  it("extracts JSON surrounded by prose", () => {
    expect(extractJson('Sure! {"a": 1} hope that helps')).toEqual({ a: 1 });
  });

  it("matches quotes case/whitespace-insensitively but requires a minimum length", () => {
    expect(quoteAppearsIn("RELYING   entirely on attention", excerpts[0]!.text)).toBe(true);
    expect(quoteAppearsIn("the", excerpts[0]!.text)).toBe(false);
  });
});

describe("AI access control", () => {
  beforeEach(resetRateLimits);

  it("reports disabled when no API key is configured", () => {
    const status = getAiStatus(env({}));
    expect(status.enabled).toBe(false);
    expect(status.reason).toMatch(/GEMINI_API_KEY/);
    expect(getAiProvider(env({ GEMINI_API_KEY: "  " }))).toBeNull();
    expect(() => authorizeAiRequest(new Headers(), env({}))).toThrow(expect.objectContaining({ code: "ai_disabled" }));
  });

  it("keeps AI disabled in production without an access token or explicit opt-in", () => {
    const prod = env({ NODE_ENV: "production", GEMINI_API_KEY: "k" });
    expect(getAiStatus(prod).enabled).toBe(false);
    expect(getAiStatus({ ...prod, AI_ALLOW_PUBLIC: "true" }).enabled).toBe(true);
  });

  it("requires the correct access token when configured", () => {
    const e = env({ NODE_ENV: "production", GEMINI_API_KEY: "k", AI_ACCESS_TOKEN: "secret-token" });
    expect(getAiStatus(e)).toMatchObject({ enabled: true, requiresToken: true });
    expect(() => authorizeAiRequest(new Headers(), e)).toThrow(expect.objectContaining({ code: "unauthorized" }));
    expect(() => authorizeAiRequest(new Headers({ "x-papermind-access": "wrong" }), e)).toThrow(expect.objectContaining({ code: "unauthorized" }));
    expect(authorizeAiRequest(new Headers({ "x-papermind-access": "secret-token" }), e).model).toBe("gemini-2.5-flash");
  });

  it("accepts a visitor's own Gemini key even when the site has no key, without exposing it", () => {
    const userKey = "AIza" + "x".repeat(35);
    const headers = new Headers({ "x-user-gemini-key": userKey });
    expect(getAiStatus(env({ NODE_ENV: "production" })).userKeyAllowed).toBe(true);
    expect(authorizeAiRequest(headers, env({ NODE_ENV: "production" })).model).toBe("gemini-2.5-flash");
    // a user key bypasses the owner's access code (it doesn't spend the owner's quota)
    expect(() => authorizeAiRequest(headers, env({ NODE_ENV: "production", GEMINI_API_KEY: "k", AI_ACCESS_TOKEN: "t" }))).not.toThrow();
  });

  it("rejects malformed personal keys and honours AI_ALLOW_USER_KEYS=false", () => {
    expect(() => authorizeAiRequest(new Headers({ "x-user-gemini-key": "not a key" }), env({}))).toThrow(expect.objectContaining({ code: "invalid_input" }));
    const off = env({ AI_ALLOW_USER_KEYS: "false" });
    expect(getAiStatus(off).userKeyAllowed).toBe(false);
    expect(() => authorizeAiRequest(new Headers({ "x-user-gemini-key": "AIza" + "y".repeat(35) }), off)).toThrow(expect.objectContaining({ code: "unauthorized" }));
  });

  it("never exposes the API key in the status payload", () => {
    expect(JSON.stringify(getAiStatus(env({ GEMINI_API_KEY: "super-secret-key" })))).not.toContain("super-secret-key");
  });

  it("rate-limits bursts per client", () => {
    for (let i = 0; i < 30; i++) checkRateLimit("1.2.3.4", 1000);
    expect(() => checkRateLimit("1.2.3.4", 1000)).toThrow(expect.objectContaining({ code: "rate_limited" }));
    expect(() => checkRateLimit("5.6.7.8", 1000)).not.toThrow();
    expect(() => checkRateLimit("1.2.3.4", 1000 + 11 * 60 * 1000)).not.toThrow();
  });
});

describe("Gemini provider error handling", () => {
  const call = (response: Response | Error) => {
    const fetchImpl = response instanceof Error ? vi.fn().mockRejectedValue(response) : vi.fn().mockResolvedValue(response);
    return new GeminiProvider({ apiKey: "k", fetchImpl, retryDelayMs: 0 }).generateJson({ system: "s", prompt: "p" });
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("maps an invalid API key to ai_disabled without leaking the key", async () => {
    const res = json({ error: { status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } }, 400);
    await expect(call(res)).rejects.toMatchObject({ code: "ai_disabled", message: expect.not.stringContaining("k=") });
  });
  it("maps quota errors to rate_limited", async () => {
    await expect(call(json({ error: { status: "RESOURCE_EXHAUSTED" } }, 429))).rejects.toMatchObject({ code: "rate_limited" });
  });
  it("maps network failures and timeouts", async () => {
    await expect(call(new TypeError("fetch failed"))).rejects.toMatchObject({ code: "network_error" });
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    await expect(call(timeout)).rejects.toMatchObject({ code: "network_error", message: expect.stringMatching(/too long/) });
  });
  it("reports truncated, blocked and empty responses", async () => {
    await expect(call(json({ candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "MAX_TOKENS" }] }))).rejects.toMatchObject({ code: "bad_ai_response" });
    await expect(call(json({ promptFeedback: { blockReason: "SAFETY" } }))).rejects.toMatchObject({ code: "bad_ai_response" });
    await expect(call(json({ candidates: [] }))).rejects.toMatchObject({ code: "bad_ai_response" });
  });
  it("retries once on a transient 503, but not on other errors", async () => {
    const ok = json({ candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }] });
    const flaky = vi.fn().mockResolvedValueOnce(json({ error: {} }, 503)).mockResolvedValueOnce(ok);
    await expect(new GeminiProvider({ apiKey: "k", fetchImpl: flaky, retryDelayMs: 0 }).generateJson({ system: "s", prompt: "p" })).resolves.toBe("{}");
    expect(flaky).toHaveBeenCalledTimes(2);

    const down = vi.fn().mockImplementation(() => Promise.resolve(json({ error: {} }, 503)));
    await expect(new GeminiProvider({ apiKey: "k", fetchImpl: down, retryDelayMs: 0 }).generateJson({ system: "s", prompt: "p" })).rejects.toMatchObject({ code: "upstream_error" });
    expect(down).toHaveBeenCalledTimes(2);

    const quota = vi.fn().mockImplementation(() => Promise.resolve(json({ error: {} }, 429)));
    await expect(new GeminiProvider({ apiKey: "k", fetchImpl: quota, retryDelayMs: 0 }).generateJson({ system: "s", prompt: "p" })).rejects.toMatchObject({ code: "rate_limited" });
    expect(quota).toHaveBeenCalledTimes(1);
  });

  it("returns concatenated text and sends the key in a header, not the URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ candidates: [{ content: { parts: [{ text: '{"a":' }, { text: "1}" }] }, finishReason: "STOP" }] }));
    const out = await new GeminiProvider({ apiKey: "secret", fetchImpl }).generateJson({ system: "s", prompt: "p" });
    expect(out).toBe('{"a":1}');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("secret");
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe("secret");
  });
});

describe("chunking and context selection", () => {
  it("keeps the whole paper when it fits and reports complete coverage", () => {
    const chunks = chunkPages([{ page: 1, text: "Short intro." }, { page: 2, text: "Method section." }]);
    const ctx = selectContext(chunks, { task: "summary", totalPages: 2 });
    expect(ctx.coverage).toMatchObject({ complete: true, pagesIncluded: [1, 2], totalPages: 2 });
    expect(ctx.excerpts.map((e) => e.id)).toEqual(["E1", "E2"]);
  });

  it("selects relevant chunks for large papers and honestly reports partial coverage", () => {
    const filler = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(30);
    const pages = Array.from({ length: 60 }, (_, i) => ({ page: i + 1, text: filler }));
    pages[41] = { page: 42, text: "We evaluate on the ImageNet dataset and CIFAR-10 benchmark against ResNet baselines using top-1 accuracy." };
    const chunks = chunkPages(pages);
    const ctx = selectContext(chunks, { task: "experiments", query: "which datasets", totalPages: 60, budgetChars: 8000 });
    expect(ctx.coverage.complete).toBe(false);
    expect(ctx.coverage.pagesIncluded).toContain(42);
    expect(ctx.coverage.pagesIncluded).toContain(1); // opening context retained
    expect(ctx.excerpts.reduce((s, e) => s + e.text.length, 0)).toBeLessThanOrEqual(8000);
    const prompt = buildAnalysisPrompt({ task: "experiments", question: null, paper: { title: "T", authors: [], year: null }, source: "fulltext", coverage: ctx.coverage, excerpts: ctx.excerpts });
    expect(prompt).toMatch(/were NOT provided/);
  });

  it("splits oversized paragraphs and never crosses pages", () => {
    const chunks = chunkPages([{ page: 3, text: "x".repeat(5000) }], 1800);
    expect(chunks.every((c) => c.page === 3 && c.text.length <= 1800)).toBe(true);
    expect(chunks).toHaveLength(3);
  });

  it("builds abstract-only context without page numbers", () => {
    expect(abstractContext("An abstract.").excerpts[0]).toEqual({ id: "E1", page: null, text: "An abstract." });
  });
});

describe("AI analyze route", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    vi.unstubAllGlobals();
    resetRateLimits();
  });

  const body = {
    task: "question",
    question: "What BLEU score is reported?",
    paper: { title: "Attention Is All You Need", authors: ["A. Vaswani"], year: 2017 },
    source: "fulltext",
    coverage: { pagesIncluded: [1, 7], totalPages: 15, selectedChunks: 2, totalChunks: 40, complete: false },
    excerpts,
  };
  const post = async (payload: unknown) => {
    const { POST } = await import("@/app/api/ai/analyze/route");
    return POST(new Request("http://localhost/api/ai/analyze", { method: "POST", body: JSON.stringify(payload) }));
  };

  it("returns 503 ai_disabled when credentials are missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await post(body);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: "ai_disabled" } });
  });

  it("validates input and returns grounded results with the provider mocked", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const modelOutput = {
      status: "supported",
      sections: [{ heading: "Answer", statements: [{ text: "28.4 BLEU on WMT14 En-De.", kind: "paper", evidence: [{ excerpt_id: "E2", quote: "28.4 BLEU" }] }] }],
      insufficient_context_note: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(modelOutput) }] }, finishReason: "STOP" }] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const bad = await post({ ...body, question: "" });
    expect(bad.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();

    const res = await post(body);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sections[0].statements[0].evidence[0]).toMatchObject({ page: 7, quoteVerified: true });
    expect(json.coverage.complete).toBe(false);
    expect(JSON.stringify(json)).not.toContain("test-key");
  });

  it("rejects oversized contexts", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `E${i + 1}`, page: i + 1, text: "y".repeat(3900) }));
    const res = await post({ ...body, excerpts: many });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/too large/);
  });
});
