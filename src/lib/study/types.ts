/** How a study item was produced — always shown to the user. */
export type StudyOrigin = "ai" | "rule-based" | "manual";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  type: "concept" | "term";
  origin: StudyOrigin;
  /** Page the card is based on, when known (null = abstract / unknown). */
  page: number | null;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  origin: StudyOrigin;
  page: number | null;
}

export interface StudyDeck {
  /** Same as the paper id it belongs to. */
  id: string;
  paperTitle: string;
  flashcards: Flashcard[];
  questions: QuizQuestion[];
  /** Ids of flashcards the user marked as known. */
  knownCards: string[];
  /** Latest answers: question id -> chosen option index. */
  answers: Record<string, number>;
  attempts: { at: string; correct: number; total: number }[];
  updatedAt: string;
}
