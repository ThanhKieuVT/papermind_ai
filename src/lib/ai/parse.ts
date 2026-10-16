import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { AnalysisSection, EvidenceRef, Excerpt, Statement, StatementKind, SupportStatus } from "@/lib/ai/types";
import { STATEMENT_KINDS } from "@/lib/ai/types";

/** Extracts and parses the first JSON object in a model response (tolerates code fences). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as unknown;
      } catch {
        // fall through
      }
    }
    throw new ApiError("bad_ai_response", "The AI returned a response that could not be parsed. Please try again.");
  }
}

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/-\s+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** True only if `quote` occurs in the excerpt text (case/whitespace-insensitive). */
export function quoteAppearsIn(quote: string, excerptText: string): boolean {
  const q = normalizeForMatch(quote);
  return q.length >= 8 && normalizeForMatch(excerptText).includes(q);
}

const rawEvidenceSchema = z.object({
  excerpt_id: z.string(),
  quote: z.string().nullish(),
});

const rawStatementSchema = z.object({
  text: z.string().min(1),
  kind: z.string().optional(),
  evidence: z.array(rawEvidenceSchema).nullish(),
});

const rawAnalysisSchema = z.object({
  status: z.string().optional(),
  sections: z.array(z.object({ heading: z.string().default(""), statements: z.array(rawStatementSchema).default([]) })),
  insufficient_context_note: z.string().nullish(),
});

function toKind(raw: string | undefined): StatementKind {
  return (STATEMENT_KINDS as readonly string[]).includes(raw ?? "") ? (raw as StatementKind) : "interpretation";
}

function toStatus(raw: string | undefined): SupportStatus {
  return raw === "supported" || raw === "partially_supported" || raw === "not_supported" ? raw : "partially_supported";
}

export function verifyEvidence(raw: z.infer<typeof rawEvidenceSchema>[], excerpts: Map<string, Excerpt>): EvidenceRef[] {
  const out: EvidenceRef[] = [];
  const seen = new Set<string>();
  for (const ev of raw) {
    const id = ev.excerpt_id.trim().toUpperCase();
    const excerpt = excerpts.get(id);
    if (!excerpt) continue; // drop references to excerpts that were never supplied
    const quote = ev.quote?.trim() || null;
    const verified = quote !== null && quoteAppearsIn(quote, excerpt.text);
    const key = `${id}|${verified ? quote : ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ excerptId: id, page: excerpt.page, quote: verified ? quote : null, quoteVerified: verified });
  }
  return out;
}

export interface ParsedAnalysis {
  status: SupportStatus;
  sections: AnalysisSection[];
  insufficientContextNote: string | null;
}

/**
 * Validates model output and enforces grounding: evidence must reference supplied
 * excerpts, quotes must appear verbatim, and "paper" statements without any valid
 * evidence are downgraded to "interpretation".
 */
export function parseAnalysis(text: string, excerpts: Excerpt[]): ParsedAnalysis {
  const parsed = rawAnalysisSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new ApiError("bad_ai_response", "The AI response did not match the expected format. Please try again.");
  }
  const byId = new Map(excerpts.map((e) => [e.id, e]));
  const sections: AnalysisSection[] = parsed.data.sections
    .map((s) => ({
      heading: s.heading.trim() || "Answer",
      statements: s.statements.map((st): Statement => {
        let kind = toKind(st.kind);
        const evidence = kind === "background" ? [] : verifyEvidence(st.evidence ?? [], byId);
        if (kind === "paper" && evidence.length === 0) kind = "interpretation";
        return { text: st.text.trim(), kind, evidence };
      }),
    }))
    .filter((s) => s.statements.length > 0);

  return {
    status: toStatus(parsed.data.status),
    sections,
    insufficientContextNote: parsed.data.insufficient_context_note?.trim() || null,
  };
}
