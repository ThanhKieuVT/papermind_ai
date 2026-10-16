import type { QuizQuestion } from "@/lib/study/types";

export interface QuizScore {
  correct: number;
  answered: number;
  total: number;
  percent: number;
  incorrect: { question: QuizQuestion; chosen: number }[];
  unanswered: QuizQuestion[];
}

export function isCorrect(question: QuizQuestion, chosen: number | undefined): boolean {
  return chosen !== undefined && chosen === question.answerIndex;
}

/** Scores answers; unanswered questions count as not correct. */
export function scoreQuiz(questions: QuizQuestion[], answers: Record<string, number>): QuizScore {
  let correct = 0;
  const incorrect: QuizScore["incorrect"] = [];
  const unanswered: QuizQuestion[] = [];
  for (const q of questions) {
    const chosen = answers[q.id];
    if (chosen === undefined) unanswered.push(q);
    else if (isCorrect(q, chosen)) correct++;
    else incorrect.push({ question: q, chosen });
  }
  const total = questions.length;
  return {
    correct,
    answered: total - unanswered.length,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    incorrect,
    unanswered,
  };
}
