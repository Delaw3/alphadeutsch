"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, RotateCcw } from "lucide-react";

import { MobileStateCard } from "@/components/mobile/MobileStates";
import {
  ASSESSMENT_SETTINGS,
  getAssessment,
  getLevel,
  isLevelId,
  type AssessmentQuestion,
  type LevelId,
  type OptionId,
} from "@/lib/assessment/config";
import {
  countAnswered,
  firstUnansweredIndex,
  scoreAssessment,
  type AnswerMap,
  type AssessmentScore,
} from "@/lib/assessment/scoring";

/**
 * Level assessment screens.
 *
 * Deliberately quiet: a slim top row (back link + level code), a progress line,
 * the question, and four flat options. Questions, pass marks and the
 * registration target all come from `src/lib/assessment/config.ts`.
 */

const PRIMARY =
  "focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-app-accent px-4 text-sm font-black text-app-on-accent transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY =
  "focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-app-border bg-app-surface px-4 text-sm font-black text-app-text transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40";
const CARD = "rounded-2xl border border-app-border bg-app-surface p-4";

type Phase = "answering" | "confirm" | "result";

function AssessmentShell({ code, children }: { code?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-[16rem] pt-4">
      <h1 className="sr-only">{code ? `${code} assessment` : "Assessment"}</h1>
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/courses"
          className="focus-ring inline-flex items-center gap-1 text-[13px] font-bold text-app-muted"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Levels
        </Link>
        {code ? (
          <span className="rounded-full bg-app-surface-2 px-3 py-1 text-[11px] font-black tracking-[0.12em] text-app-muted">
            {code}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function LevelAssessmentScreen({ level }: { level: string }) {
  if (!isLevelId(level)) {
    return (
      <AssessmentShell>
        <div className="mt-4">
          <MobileStateCard
            title="Level not found"
            description={`“${level}” is not a level we assess. Choose A1, A2, B1 or B2.`}
          />
        </div>
      </AssessmentShell>
    );
  }

  const assessment = getAssessment(level);
  if (!assessment.active || assessment.questions.length === 0) {
    const definition = getLevel(level);
    return (
      <AssessmentShell code={definition.code}>
        <div className="mt-4">
          <MobileStateCard
            title="Not open yet"
            description={`The ${definition.code} assessment is not open right now. Please check back soon.`}
          />
        </div>
      </AssessmentShell>
    );
  }

  return <AssessmentRunner level={level} />;
}

function AssessmentRunner({ level }: { level: LevelId }) {
  const assessment = getAssessment(level);
  const definition = getLevel(level);
  const questions = assessment.questions;
  const total = questions.length;

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [score, setScore] = useState<AssessmentScore | null>(null);

  const question = questions[Math.min(index, total - 1)];
  const answeredCount = countAnswered(questions, answers);
  const complete = answeredCount === total;
  const isLast = index === total - 1;

  function select(optionId: OptionId) {
    setAnswers((previous) => ({ ...previous, [question.id]: optionId }));
  }

  function goTo(target: number) {
    setIndex(Math.max(0, Math.min(total - 1, target)));
  }

  function requestSubmit() {
    if (!complete) return;
    setPhase("confirm");
  }

  function confirmSubmit() {
    setScore(scoreAssessment(assessment, answers));
    setPhase("result");
  }

  function retry() {
    setAnswers({});
    setIndex(0);
    setScore(null);
    setPhase("answering");
  }

  if (phase === "result" && score) {
    return <ResultView code={definition.code} name={definition.name} score={score} onRetry={retry} />;
  }

  if (phase === "confirm") {
    return (
      <ConfirmView
        code={definition.code}
        total={total}
        passMarkPercent={assessment.passMarkPercent}
        onConfirm={confirmSubmit}
        onCancel={() => setPhase("answering")}
      />
    );
  }

  return (
    <AnsweringView
      code={definition.code}
      question={question}
      index={index}
      total={total}
      selected={answers[question.id]}
      answeredCount={answeredCount}
      complete={complete}
      isLast={isLast}
      onSelect={select}
      onPrev={() => goTo(index - 1)}
      onNext={() => goTo(index + 1)}
      onSubmit={requestSubmit}
      onJumpToFirstUnanswered={() => goTo(firstUnansweredIndex(questions, answers))}
    />
  );
}

function AnsweringView({
  code,
  question,
  index,
  total,
  selected,
  answeredCount,
  complete,
  isLast,
  onSelect,
  onPrev,
  onNext,
  onSubmit,
  onJumpToFirstUnanswered,
}: {
  code: string;
  question: AssessmentQuestion;
  index: number;
  total: number;
  selected: OptionId | undefined;
  answeredCount: number;
  complete: boolean;
  isLast: boolean;
  onSelect: (id: OptionId) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onJumpToFirstUnanswered: () => void;
}) {
  const progress = Math.round(((index + 1) / total) * 100);
  const remaining = total - answeredCount;

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const hasMounted = useRef(false);

  // When the student changes question, move focus to the new prompt so keyboard
  // and screen-reader users start at the question instead of being left on the
  // Previous/Next button. Skipped on first render so opening the screen does not
  // steal focus.
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  return (
    <AssessmentShell code={code}>
      <div className="mt-4 flex items-baseline justify-between">
        <p className="text-[12px] font-bold text-app-muted">
          Question {index + 1} of {total}
        </p>
        <p className="text-[12px] font-bold tabular-nums text-app-muted">{answeredCount}/{total}</p>
      </div>

      {/* Announced politely on each change; the question text itself is read when
          focus moves to the heading below, so options are never read out. */}
      <p role="status" aria-live="polite" className="sr-only">
        Question {index + 1} of {total}
      </p>

      <div
        role="progressbar"
        aria-label="Assessment progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={`Question ${index + 1} of ${total}`}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-app-surface-2"
      >
        <div
          className="h-full rounded-full bg-app-accent transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h2
        id="assessment-question"
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 text-[17px] font-black leading-7 text-app-text focus:outline-none"
      >
        {question.prompt}
      </h2>

      <div
        role="group"
        aria-labelledby="assessment-question"
        className="mt-4 grid grid-cols-1 gap-2"
      >
        {question.options.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.id)}
              className={`focus-ring flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition active:scale-[0.995] ${
                isSelected ? "border-app-accent bg-app-accent/10" : "border-app-border bg-app-surface"
              }`}
            >
              <span
                aria-hidden="true"
                className={`shrink-0 pt-0.5 text-[12px] font-black ${
                  isSelected ? "text-app-text" : "text-app-muted"
                }`}
              >
                {option.id.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-6 text-app-text">{option.text}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button type="button" onClick={onPrev} disabled={index === 0} className={SECONDARY}>
          Previous
        </button>
        {isLast ? (
          <button type="button" onClick={onSubmit} disabled={!complete} className={PRIMARY}>
            Submit
          </button>
        ) : (
          <button type="button" onClick={onNext} className={PRIMARY}>
            Next
          </button>
        )}
      </div>

      {isLast && !complete ? (
        <p className="mt-3 text-center text-[12px] font-medium leading-5 text-app-muted">
          {remaining} unanswered —{" "}
          <button
            type="button"
            onClick={onJumpToFirstUnanswered}
            className="focus-ring font-bold text-app-text underline underline-offset-4"
          >
            go to first unanswered
          </button>
        </p>
      ) : null}
    </AssessmentShell>
  );
}

function ConfirmView({
  code,
  total,
  passMarkPercent,
  onConfirm,
  onCancel,
}: {
  code: string;
  total: number;
  passMarkPercent: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AssessmentShell code={code}>
      <div className={`${CARD} mt-4`}>
        <p className="text-[15px] font-black text-app-text">Submit your answers?</p>
        <p className="mt-1 text-[13px] leading-6 text-app-muted">
          You answered all {total} questions. You need {passMarkPercent}% to pass.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={onCancel} className={SECONDARY}>
            Back
          </button>
          <button type="button" onClick={onConfirm} className={PRIMARY}>
            Submit
          </button>
        </div>
      </div>
    </AssessmentShell>
  );
}

function ResultView({
  code,
  name,
  score,
  onRetry,
}: {
  code: string;
  name: string;
  score: AssessmentScore;
  onRetry: () => void;
}) {
  const [showRegistrationNotice, setShowRegistrationNotice] = useState(false);
  const registrationUrl = ASSESSMENT_SETTINGS.registrationUrl;
  const passed = score.passed;

  return (
    <AssessmentShell code={code}>
      <div className={`${CARD} mt-4`} aria-live="polite">
        <p className="text-[12px] font-bold text-app-muted">{name}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-black tabular-nums text-app-text">{score.percent}%</span>
          <span
            className={`text-[12px] font-black ${
              passed ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {passed ? "Passed" : "Not passed"}
          </span>
        </div>
        <p className="mt-1 text-[13px] leading-6 text-app-muted">
          {score.correct} of {score.total} correct · pass mark {score.passMarkPercent}%
        </p>
      </div>

      {passed ? (
        <div className="mt-4 flex flex-col gap-2">
          {registrationUrl ? (
            <a href={registrationUrl} className={PRIMARY}>
              Proceed to Registration
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowRegistrationNotice(true)}
              className={PRIMARY}
            >
              Proceed to Registration
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={onRetry} className={PRIMARY}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      )}

      {showRegistrationNotice && !registrationUrl ? (
        <p
          role="status"
          className="mt-3 rounded-xl border border-app-border bg-app-surface-2 px-4 py-3 text-center text-[13px] font-medium leading-6 text-app-muted"
        >
          {ASSESSMENT_SETTINGS.registrationComingSoonMessage}
        </p>
      ) : null}
    </AssessmentShell>
  );
}
