"use client";

import { useState, type FormEvent } from "react";
import type { Flashcard, QuizQuestion } from "@/lib/study/types";
import { Button, inputClass, labelClass } from "@/components/ui/primitives";

const uid = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function ManualItemForm({
  onAddCard,
  onAddQuestion,
}: {
  onAddCard: (card: Flashcard) => void;
  onAddQuestion: (q: QuizQuestion) => void;
}) {
  const [mode, setMode] = useState<"card" | "question">("card");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "card") {
      if (!front.trim() || !back.trim()) return setError("Both sides of the card are required.");
      onAddCard({ id: uid(), front: front.trim(), back: back.trim(), type: "concept", origin: "manual", page: null });
      setFront("");
      setBack("");
      return;
    }
    const filled = options.map((o) => o.trim());
    if (!question.trim() || filled.some((o) => !o)) return setError("Enter the question and all four options.");
    if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) return setError("Options must be different.");
    onAddQuestion({ id: uid(), question: question.trim(), options: filled, answerIndex: answer, explanation: explanation.trim(), origin: "manual", page: null });
    setQuestion("");
    setOptions(["", "", "", ""]);
    setAnswer(0);
    setExplanation("");
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Item type">
        <label className="flex items-center gap-2"><input type="radio" checked={mode === "card"} onChange={() => setMode("card")} /> Flashcard</label>
        <label className="flex items-center gap-2"><input type="radio" checked={mode === "question"} onChange={() => setMode("question")} /> Quiz question</label>
      </div>
      {mode === "card" ? (
        <>
          <div><label htmlFor="m-front" className={labelClass}>Front</label><input id="m-front" className={inputClass} value={front} onChange={(e) => setFront(e.target.value)} maxLength={500} /></div>
          <div><label htmlFor="m-back" className={labelClass}>Back</label><textarea id="m-back" className={inputClass} value={back} onChange={(e) => setBack(e.target.value)} maxLength={1500} /></div>
        </>
      ) : (
        <>
          <div><label htmlFor="m-q" className={labelClass}>Question</label><input id="m-q" className={inputClass} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={800} /></div>
          <fieldset className="space-y-2">
            <legend className={labelClass}>Options (select the correct one)</legend>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="m-answer" aria-label={`Option ${i + 1} is correct`} checked={answer === i} onChange={() => setAnswer(i)} />
                <input aria-label={`Option ${i + 1}`} className={inputClass} value={o} onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} maxLength={400} />
              </div>
            ))}
          </fieldset>
          <div><label htmlFor="m-exp" className={labelClass}>Explanation (optional)</label><input id="m-exp" className={inputClass} value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={1500} /></div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <Button type="submit">Add {mode === "card" ? "flashcard" : "question"}</Button>
    </form>
  );
}
