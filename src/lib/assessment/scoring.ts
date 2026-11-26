/**
 * Assessment scoring.
 *
 * Pure functions only — no React, no storage, no network — so the same rules can
 * later run on a server (or be unit-tested) without the UI.
 *
 * The pass mark always comes from the level's configuration; nothing here
 * assumes 50%.
 */
import type { AssessmentQuestion, LevelAssessment, OptionId } from "./config";

/** Answers keyed by question id. Missing / undefined = not answered yet. */
export type AnswerMap = Record<string, OptionId | undefined>;

export type AssessmentScore = {
  total: number;
  correct: number;
  answered: number;
  unanswered: number;
  /** 0–100, rounded to the nearest whole percent. */
  percent: number;
  passMarkPercent: number;
  /** How many correct answers are needed to reach the pass mark. */
  requiredCorrect: number;
  passed: boolean;
};

export function isAnswered(answer: OptionId | undefined): boolean {
  return answer === "a" || answer === "b" || answer === "c" || answer === "d";
}

export function countAnswered(
  questions: readonly AssessmentQuestion[],
  answers: AnswerMap,
): number {
  return questions.reduce((total, question) => total + (isAnswered(answers[question.id]) ? 1 : 0), 0);
}

/** Index of the first unanswered question, or -1 when the test is complete. */
export function firstUnansweredIndex(
  questions: readonly AssessmentQuestion[],
  answers: AnswerMap,
): number {
  return questions.findIndex((question) => !isAnswered(answers[question.id]));
}

/**
 * Smallest whole number of correct answers that reaches `passMarkPercent`.
 * 50% of 10 questions → 5; 50% of 7 questions → 4 (57% ≥ 50%).
 */
export function requiredCorrectAnswers(passMarkPercent: number, total: number): number {
  if (total <= 0) return 0;
  const clamped = Math.min(100, Math.max(0, passMarkPercent));
  return Math.ceil((clamped / 100) * total);
}

export function scoreAssessment(
  assessment: LevelAssessment,
  answers: AnswerMap,
): AssessmentScore {
  const questions = assessment.questions;
  const total = questions.length;
  const correct = questions.reduce(
    (sum, question) => sum + (answers[question.id] === question.correctOptionId ? 1 : 0),
    0,
  );
  const answered = countAnswered(questions, answers);
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const passMarkPercent = assessment.passMarkPercent;

  return {
    total,
    correct,
    answered,
    unanswered: total - answered,
    percent,
    passMarkPercent,
    requiredCorrect: requiredCorrectAnswers(passMarkPercent, total),
    passed: total > 0 && percent >= passMarkPercent,
  };
}
