import { describe, expect, it } from "vitest";
import { scoreQuiz } from "@/lib/study/quiz";
import { extractAcronyms, extractDefinitions, generateRuleBasedStudy } from "@/lib/study/rules";
import { parseStudy } from "@/lib/study/parse";
import type { QuizQuestion } from "@/lib/study/types";

const q = (id: string, answerIndex: number): QuizQuestion => ({
  id,
  question: id,
  options: ["a", "b", "c", "d"],
  answerIndex,
  explanation: "",
  origin: "manual",
  page: null,
});

describe("quiz scoring", () => {
  const questions = [q("q1", 0), q("q2", 1), q("q3", 2), q("q4", 3)];

  it("scores correct, incorrect and unanswered questions", () => {
    const s = scoreQuiz(questions, { q1: 0, q2: 1, q3: 0 });
    expect(s).toMatchObject({ correct: 2, answered: 3, total: 4, percent: 50 });
    expect(s.incorrect.map((i) => [i.question.id, i.chosen])).toEqual([["q3", 0]]);
    expect(s.unanswered.map((u) => u.id)).toEqual(["q4"]);
  });

  it("handles perfect and empty quizzes", () => {
    expect(scoreQuiz(questions, { q1: 0, q2: 1, q3: 2, q4: 3 }).percent).toBe(100);
    expect(scoreQuiz([], {})).toMatchObject({ total: 0, percent: 0 });
  });
});

describe("rule-based study generation", () => {
  const pages = [
    {
      page: 1,
      text: "We build on Long Short-Term Memory (LSTM) networks and Convolutional Neural Networks (CNNs). The Natural Language Processing (NLP) community uses the Transformer.",
    },
    {
      page: 2,
      text: "We compare with Recurrent Neural Network (RNN) models. Self-attention is defined as a mechanism relating different positions of a single sequence.",
    },
  ];

  it("extracts acronyms whose initials match the expansion", () => {
    const acr = extractAcronyms(pages);
    expect(acr.map((a) => [a.term, a.definition, a.page])).toEqual([
      ["LSTM", "Long Short-Term Memory", 1],
      ["CNNs", "Convolutional Neural Networks", 1],
      ["NLP", "Natural Language Processing", 1],
      ["RNN", "Recurrent Neural Network", 2],
    ]);
  });

  it("extracts explicit definitions", () => {
    expect(extractDefinitions(pages)).toEqual([
      { term: "Self-attention", definition: "a mechanism relating different positions of a single sequence", page: 2 },
    ]);
  });

  it("labels output as rule-based and builds valid MCQs only when enough acronyms exist", () => {
    const result = generateRuleBasedStudy(pages);
    expect(result.flashcards.every((c) => c.origin === "rule-based")).toBe(true);
    expect(result.questions).toHaveLength(4);
    for (const question of result.questions) {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
    }
    expect(generateRuleBasedStudy([{ page: 1, text: "No acronyms here at all." }])).toEqual({ flashcards: [], questions: [] });
  });
});

describe("AI study parsing", () => {
  const excerpts = [{ id: "E1", page: 3, text: "The encoder maps inputs to continuous representations." }];

  it("keeps grounded items and discards invalid or ungrounded ones", () => {
    const text = JSON.stringify({
      flashcards: [
        { front: "Encoder role", back: "Maps inputs to continuous representations", type: "concept", evidence_id: "E1" },
        { front: "Ungrounded", back: "x", type: "term", evidence_id: "E5" },
      ],
      questions: [
        { question: "What does the encoder do?", options: ["Maps inputs", "Decodes", "Tokenizes", "Nothing"], answer_index: 0, explanation: "See E1", evidence_id: "E1" },
        { question: "Bad index", options: ["a", "b"], answer_index: 5, explanation: "", evidence_id: "E1" },
        { question: "Duplicate options", options: ["a", "A"], answer_index: 0, explanation: "", evidence_id: "E1" },
      ],
    });
    const parsed = parseStudy(text, excerpts, "t");
    expect(parsed.flashcards).toHaveLength(1);
    expect(parsed.flashcards[0]).toMatchObject({ origin: "ai", page: 3 });
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.discarded).toBe(3);
  });

  it("rejects malformed output", () => {
    expect(() => parseStudy('{"flashcards": "nope"}', excerpts, "t")).toThrow(/expected format/);
  });
});
