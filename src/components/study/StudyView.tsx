"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LibraryEntry, PageText } from "@/types/paper";
import type { Flashcard, QuizQuestion, StudyDeck, StudyOrigin } from "@/lib/study/types";
import { OriginBadge } from "@/components/study/OriginBadge";
import { useLibrary } from "@/hooks/useLibrary";
import { getDocument } from "@/lib/storage/library";
import { emptyDeck, getDeck, saveDeck } from "@/lib/storage/study";
import { generateRuleBasedStudy } from "@/lib/study/rules";
import { buildPaperContext, paperHeader } from "@/lib/ai/context";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, cx, inputClass, labelClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { useAiAvailability } from "@/components/ai/AiStatusNotice";
import { FlashcardViewer } from "@/components/study/FlashcardViewer";
import { QuizRunner } from "@/components/study/QuizRunner";
import { ManualItemForm } from "@/components/study/ManualItemForm";

type Tab = "cards" | "quiz" | "manage";

export function StudyView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { entries, loading } = useLibrary();
  const paperId = params.get("paper");
  const entry = entries.find((e) => e.paper.id === paperId) ?? null;

  return (
    <>
      <PageHeader title="Study Center" description="Flashcards and quizzes built from a paper in your library. Every item shows how it was created: AI-generated, rule-based or manual." />
      {loading && <Spinner label="Loading library…" />}
      {!loading && entries.length === 0 && (
        <EmptyState title="No papers to study" action={<Link className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" href="/discover">Discover papers →</Link>}>
          Save a paper to your library first.
        </EmptyState>
      )}
      {!loading && entries.length > 0 && (
        <Card className="mb-4">
          <label htmlFor="study-paper" className={labelClass}>Paper</label>
          <select
            id="study-paper"
            className={inputClass}
            value={paperId ?? ""}
            onChange={(e) => router.replace(e.target.value ? `${pathname}?paper=${encodeURIComponent(e.target.value)}` : pathname)}
          >
            <option value="">Select a paper…</option>
            {entries.map((e) => <option key={e.paper.id} value={e.paper.id}>{e.paper.title}</option>)}
          </select>
        </Card>
      )}
      {!loading && paperId && !entry && <Alert tone="error">That paper is not in your library.</Alert>}
      {entry && <DeckWorkspace key={entry.paper.id} entry={entry} />}
    </>
  );
}

function DeckWorkspace({ entry }: { entry: LibraryEntry }) {
  const notify = useToast();
  const { ready, notice } = useAiAvailability();
  const [deck, setDeck] = useState<StudyDeck | null>(null);
  const [pages, setPages] = useState<PageText[] | null>(null);
  const [scanned, setScanned] = useState(false);
  const [tab, setTab] = useState<Tab>("cards");
  const [busy, setBusy] = useState<"ai" | "rules" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = (await getDeck(entry.paper.id)) ?? emptyDeck(entry.paper.id, entry.paper.title);
        const doc = entry.documentId ? await getDocument(entry.documentId) : undefined;
        if (!active) return;
        setDeck(stored);
        setPages(doc && !doc.likelyScanned ? doc.pages : null);
        setScanned(Boolean(doc?.likelyScanned));
      } catch (e) {
        if (active) setError(errorMessage(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [entry]);

  const persist = useCallback(async (next: StudyDeck) => {
    setDeck(next);
    try {
      setDeck(await saveDeck(next));
    } catch (e) {
      notify(`Progress could not be saved: ${errorMessage(e)}`, "error");
    }
  }, [notify]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!deck) return <Spinner label="Loading study deck…" />;

  const textSource: PageText[] | null = pages ?? (entry.paper.abstract ? [{ page: 0, text: entry.paper.abstract }] : null);

  const replaceOrigin = (origin: StudyOrigin, cards: Flashcard[], questions: QuizQuestion[]) => {
    const keptCards = deck.flashcards.filter((c) => c.origin !== origin);
    const keptQuestions = deck.questions.filter((q) => q.origin !== origin);
    const answers = Object.fromEntries(Object.entries(deck.answers).filter(([id]) => keptQuestions.some((q) => q.id === id)));
    void persist({ ...deck, flashcards: [...keptCards, ...cards], questions: [...keptQuestions, ...questions], answers });
  };

  const generateRules = () => {
    if (!textSource) return;
    setBusy("rules");
    const result = generateRuleBasedStudy(textSource, `rb-${Date.now().toString(36)}`);
    // page 0 marks abstract text; store it as unknown page
    const fix = <T extends { page: number | null }>(x: T): T => ({ ...x, page: x.page === 0 ? null : x.page });
    replaceOrigin("rule-based", result.flashcards.map(fix), result.questions.map(fix));
    notify(
      result.flashcards.length
        ? `Rule-based extraction found ${result.flashcards.length} card(s) and ${result.questions.length} question(s).`
        : "No acronyms or explicit definitions were found in the text.",
      result.flashcards.length ? "success" : "info",
    );
    setBusy(null);
  };

  const generateAi = async () => {
    setBusy("ai");
    setError(null);
    try {
      const doc = entry.documentId ? await getDocument(entry.documentId) : undefined;
      const ctx = buildPaperContext(entry.paper, doc, { task: "summary", query: "definition concept method result contribution" });
      if (ctx.source === "metadata") throw new Error("No text is available for this paper.");
      const res = await apiFetch<{ flashcards: Flashcard[]; questions: QuizQuestion[]; discarded: number }>("/api/ai/study", {
        method: "POST",
        body: JSON.stringify({ paperId: entry.paper.id, paper: paperHeader(entry.paper), source: ctx.source, excerpts: ctx.excerpts }),
      });
      replaceOrigin("ai", res.flashcards, res.questions);
      notify(`Generated ${res.flashcards.length} flashcards and ${res.questions.length} questions${res.discarded ? ` (${res.discarded} invalid item(s) discarded)` : ""}.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold">{entry.paper.title}</h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Study source:{" "}
          {pages ? <Badge tone="green">Attached PDF text</Badge> : entry.paper.abstract ? <Badge tone="amber">Abstract only</Badge> : <Badge tone="red">No text available</Badge>}
        </p>
        {scanned && <Alert tone="warning" className="mt-2">The attached PDF appears to be scanned; its text cannot be used.</Alert>}
        <div className="mt-4 flex flex-wrap gap-2">
          {ready && textSource && <Button onClick={generateAi} loading={busy === "ai"} disabled={busy !== null}>Generate with AI</Button>}
          <Button variant="secondary" onClick={generateRules} loading={busy === "rules"} disabled={!textSource || busy !== null}>
            Generate rule-based (no AI)
          </Button>
          <Button variant="ghost" onClick={() => setTab("manage")}>Create cards manually</Button>
        </div>
        <div className="mt-3">{notice}</div>
        {!textSource && <p className="mt-2 text-sm text-stone-500">Attach a PDF in the Reader to generate study materials from this paper, or create cards manually.</p>}
        {error && <Alert tone="error" className="mt-3" title="Generation failed">{error}</Alert>}
      </Card>

      <div role="tablist" aria-label="Study modes" className="flex gap-1 border-b border-stone-200 dark:border-stone-700">
        {([
          ["cards", `Flashcards (${deck.flashcards.length})`],
          ["quiz", `Quiz (${deck.questions.length})`],
          ["manage", "Manage"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-stone-600 dark:text-stone-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cards" && (
        <FlashcardViewer
          cards={deck.flashcards}
          known={deck.knownCards}
          onToggleKnown={(id) =>
            void persist({
              ...deck,
              knownCards: deck.knownCards.includes(id) ? deck.knownCards.filter((k) => k !== id) : [...deck.knownCards, id],
            })
          }
        />
      )}
      {tab === "quiz" && (
        <QuizRunner
          key={deck.questions.map((q) => q.id).join("|")}
          questions={deck.questions}
          savedAnswers={deck.answers}
          attempts={deck.attempts}
          onSubmit={(answers, score) =>
            void persist({
              ...deck,
              answers,
              attempts: [...deck.attempts, { at: new Date().toISOString(), correct: score.correct, total: score.total }].slice(-20),
            })
          }
          onReset={() => void persist({ ...deck, answers: {} })}
        />
      )}
      {tab === "manage" && (
        <ManageItems
          deck={deck}
          onChange={(next) => void persist(next)}
        />
      )}
    </div>
  );
}

function ManageItems({ deck, onChange }: { deck: StudyDeck; onChange: (deck: StudyDeck) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 font-semibold">Add your own</h3>
        <ManualItemForm
          onAddCard={(card) => onChange({ ...deck, flashcards: [...deck.flashcards, card] })}
          onAddQuestion={(q) => onChange({ ...deck, questions: [...deck.questions, q] })}
        />
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">All items</h3>
        {deck.flashcards.length + deck.questions.length === 0 && <p className="text-sm text-stone-500">No study items yet.</p>}
        <ul className="max-h-[32rem] space-y-2 overflow-auto text-sm">
          {deck.flashcards.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-stone-200 p-2 dark:border-stone-700">
              <div><OriginBadge origin={c.origin} page={c.page} /> <span className="font-medium">{c.front}</span></div>
              <Button size="sm" variant="ghost" aria-label={`Delete card ${c.front}`} onClick={() => onChange({ ...deck, flashcards: deck.flashcards.filter((x) => x.id !== c.id), knownCards: deck.knownCards.filter((k) => k !== c.id) })}>✕</Button>
            </li>
          ))}
          {deck.questions.map((q) => (
            <li key={q.id} className="flex items-start justify-between gap-2 rounded-lg border border-stone-200 p-2 dark:border-stone-700">
              <div><OriginBadge origin={q.origin} page={q.page} /> <Badge tone="blue">Quiz</Badge> <span>{q.question}</span></div>
              <Button size="sm" variant="ghost" aria-label={`Delete question ${q.question}`} onClick={() => {
                const answers = { ...deck.answers };
                delete answers[q.id];
                onChange({ ...deck, questions: deck.questions.filter((x) => x.id !== q.id), answers });
              }}>✕</Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
