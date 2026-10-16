"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/study/types";
import { Button, Card, EmptyState } from "@/components/ui/primitives";
import { OriginBadge } from "@/components/study/OriginBadge";

export function FlashcardViewer({
  cards,
  known,
  onToggleKnown,
}: {
  cards: Flashcard[];
  known: string[];
  onToggleKnown: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hideKnown, setHideKnown] = useState(false);

  const visible = hideKnown ? cards.filter((c) => !known.includes(c.id)) : cards;
  if (cards.length === 0) return <EmptyState title="No flashcards yet">Generate cards above or create them manually.</EmptyState>;
  if (visible.length === 0) {
    return (
      <EmptyState title="All cards marked as known 🎉" action={<Button variant="secondary" onClick={() => setHideKnown(false)}>Show all cards</Button>} />
    );
  }
  const i = Math.min(index, visible.length - 1);
  const card = visible[i]!;
  const go = (n: number) => {
    setIndex((n + visible.length) % visible.length);
    setFlipped(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600 dark:text-stone-300">
        <span>Card {i + 1} of {visible.length} · {known.length} known</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={hideKnown} onChange={(e) => { setHideKnown(e.target.checked); setIndex(0); }} />
          Hide known cards
        </label>
      </div>
      <Card className="min-h-56">
        <div className="mb-2 flex items-center justify-between">
          <OriginBadge origin={card.origin} page={card.page} />
          <span className="text-xs uppercase tracking-wide text-stone-500">{card.type === "term" ? "Term" : "Concept"} · {flipped ? "Answer" : "Question"}</span>
        </div>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="flex min-h-40 w-full items-center justify-center rounded-lg p-4 text-center text-lg hover:bg-stone-50 dark:hover:bg-stone-800"
          aria-label={flipped ? "Show question side" : "Show answer side"}
          aria-live="polite"
        >
          {flipped ? card.back : card.front}
        </button>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => go(i - 1)}>← Previous</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setFlipped((f) => !f)}>{flipped ? "Show question" : "Reveal answer"}</Button>
          <Button variant={known.includes(card.id) ? "secondary" : "primary"} onClick={() => onToggleKnown(card.id)}>
            {known.includes(card.id) ? "Mark as not known" : "I know this"}
          </Button>
        </div>
        <Button variant="secondary" onClick={() => go(i + 1)}>Next →</Button>
      </div>
    </div>
  );
}
