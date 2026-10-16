"use client";

import { useState, type FormEvent } from "react";
import type { Paper, StoredDocument } from "@/types/paper";
import { AI_TASKS, LIMITS, TASK_LABELS, type AiTask, type AnalysisResult } from "@/lib/ai/types";
import { buildPaperContext, paperHeader } from "@/lib/ai/context";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { Alert, Button, inputClass, labelClass } from "@/components/ui/primitives";
import { AnalysisView } from "@/components/ai/AnalysisView";
import { useAiAvailability } from "@/components/ai/AiStatusNotice";

interface HistoryItem {
  id: number;
  question: string | null;
  result: AnalysisResult;
}

export function AiAssistantPanel({
  paper,
  doc,
  onJumpToPage,
}: {
  paper: Paper;
  doc: StoredDocument | null;
  onJumpToPage?: (page: number) => void;
}) {
  const { ready, notice } = useAiAvailability();
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<AiTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const basis = doc && !doc.likelyScanned ? "fulltext" : paper.abstract ? "abstract" : "metadata";

  const run = async (task: AiTask, q: string | null) => {
    setPending(task);
    setError(null);
    try {
      const context = buildPaperContext(paper, doc, { task, query: q ?? undefined });
      if (context.excerpts.length === 0) {
        throw new Error("There is no paper text to analyze. Upload the PDF or use a paper with an abstract.");
      }
      const result = await apiFetch<AnalysisResult>("/api/ai/analyze", {
        method: "POST",
        body: JSON.stringify({
          task,
          question: q,
          paper: paperHeader(paper),
          source: context.source,
          coverage: context.coverage,
          excerpts: context.excerpts,
        }),
      });
      setHistory((h) => [{ id: Date.now(), question: q, result }, ...h]);
      if (task === "question") setQuestion("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const onAsk = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3) {
      setError("Please enter a question (at least 3 characters).");
      return;
    }
    void run("question", q);
  };

  return (
    <section aria-labelledby="ai-panel-title" className="space-y-4">
      <h2 id="ai-panel-title" className="text-lg font-semibold">AI Paper Assistant</h2>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Content sent for analysis:{" "}
        <strong>
          {basis === "fulltext" ? `extracted text of ${doc?.fileName}` : basis === "abstract" ? "abstract only" : "none available"}
        </strong>
        . Text is sent to the server-side AI provider only when you click an action below.
      </p>
      {doc?.likelyScanned && (
        <Alert tone="warning">This PDF appears to be scanned (no extractable text). AI analysis can only use the abstract, if any.</Alert>
      )}
      {notice}
      {ready && basis === "metadata" && <Alert tone="warning">No text is available for this paper. Upload a text-based PDF to use the assistant.</Alert>}

      {ready && basis !== "metadata" && (
        <>
          <div className="flex flex-wrap gap-2">
            {AI_TASKS.filter((t) => t !== "question").map((task) => (
              <Button key={task} size="sm" variant="secondary" loading={pending === task} disabled={pending !== null} onClick={() => void run(task, null)}>
                {TASK_LABELS[task]}
              </Button>
            ))}
          </div>
          <form onSubmit={onAsk} className="space-y-2">
            <label htmlFor="ai-question" className={labelClass}>Ask a question about this paper</label>
            <textarea
              id="ai-question"
              className={`${inputClass} min-h-20`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={LIMITS.maxQuestionChars}
              placeholder="e.g. What loss function do the authors use, and why?"
            />
            <Button type="submit" loading={pending === "question"} disabled={pending !== null}>Ask</Button>
          </form>
        </>
      )}

      {error && <Alert tone="error" title="AI request failed">{error}</Alert>}
      <div className="space-y-4" aria-live="polite">
        {history.map((item) => (
          <AnalysisView key={item.id} result={item.result} question={item.question} onJumpToPage={onJumpToPage} />
        ))}
      </div>
    </section>
  );
}
