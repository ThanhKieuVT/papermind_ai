"use client";

import { useState } from "react";
import type { QuizQuestion, StudyDeck } from "@/lib/study/types";
import { isCorrect, scoreQuiz, type QuizScore } from "@/lib/study/quiz";
import { Alert, Button, Card, EmptyState, cx } from "@/components/ui/primitives";
import { OriginBadge } from "@/components/study/OriginBadge";

export function QuizRunner({
  questions,
  savedAnswers,
  attempts,
  onSubmit,
  onReset,
}: {
  questions: QuizQuestion[];
  savedAnswers: Record<string, number>;
  attempts: StudyDeck["attempts"];
  onSubmit: (answers: Record<string, number>, score: QuizScore) => void;
  onReset: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>(savedAnswers);
  const [submitted, setSubmitted] = useState(Object.keys(savedAnswers).length > 0 && Object.keys(savedAnswers).length === questions.length);
  const [reviewOnlyWrong, setReviewOnlyWrong] = useState(false);

  if (questions.length === 0) return <EmptyState title="No quiz questions yet">Generate questions above or add your own in Manage.</EmptyState>;

  const score = scoreQuiz(questions, answers);
  const shown = submitted && reviewOnlyWrong ? questions.filter((q) => !isCorrect(q, answers[q.id])) : questions;

  return (
    <div className="space-y-4">
      {submitted && (
        <Alert tone={score.percent >= 70 ? "success" : "warning"} title={`Score: ${score.correct} / ${score.total} (${score.percent}%)`}>
          {score.incorrect.length + score.unanswered.length === 0 ? "Perfect — every answer is correct." : `${score.incorrect.length} incorrect, ${score.unanswered.length} unanswered.`}
          {attempts.length > 1 && <> Previous attempts: {attempts.slice(-6, -1).map((a) => `${a.correct}/${a.total}`).join(", ")}.</>}
        </Alert>
      )}
      {submitted && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={reviewOnlyWrong} onChange={(e) => setReviewOnlyWrong(e.target.checked)} />
          Review incorrect answers only
        </label>
      )}
      <ol className="space-y-3">
        {shown.map((q) => {
          const n = questions.indexOf(q) + 1;
          const chosen = answers[q.id];
          return (
            <li key={q.id}>
              <Card>
                <fieldset>
                  <legend className="mb-2 flex flex-wrap items-center gap-2 font-medium">
                    <span>{n}. {q.question}</span> <OriginBadge origin={q.origin} page={q.page} />
                  </legend>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const isAnswer = oi === q.answerIndex;
                      const picked = chosen === oi;
                      return (
                        <label
                          key={oi}
                          className={cx(
                            "flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm",
                            !submitted && "border-stone-200 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800",
                            submitted && isAnswer && "border-emerald-400 bg-emerald-50 dark:bg-emerald-950",
                            submitted && picked && !isAnswer && "border-red-400 bg-red-50 dark:bg-red-950",
                            submitted && !isAnswer && !picked && "border-stone-200 dark:border-stone-700",
                          )}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            className="mt-0.5 h-4 w-4"
                            checked={picked}
                            disabled={submitted}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                          />
                          <span>
                            {opt}
                            {submitted && isAnswer && <span className="ml-2 font-medium text-emerald-700 dark:text-emerald-300">✓ correct answer</span>}
                            {submitted && picked && !isAnswer && <span className="ml-2 font-medium text-red-700 dark:text-red-300">✗ your answer</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {submitted && chosen === undefined && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Not answered.</p>}
                  {submitted && q.explanation && <p className="mt-2 text-sm text-stone-600 dark:text-stone-300"><strong>Explanation:</strong> {q.explanation}</p>}
                </fieldset>
              </Card>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {!submitted ? (
          <Button
            onClick={() => {
              setSubmitted(true);
              onSubmit(answers, scoreQuiz(questions, answers));
            }}
          >
            Submit answers ({score.answered}/{score.total} answered)
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
              setReviewOnlyWrong(false);
              onReset();
            }}
          >
            Retake quiz
          </Button>
        )}
      </div>
    </div>
  );
}
