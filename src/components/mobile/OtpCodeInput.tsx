"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

export const OTP_LENGTH = 6;

type OtpCodeInputProps = {
  /** Current code: up to six digits. Anything else is ignored. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** id of the element that explains a validation error. */
  describedBy?: string;
};

function toDigits(value: string): string[] {
  return Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? "");
}

/**
 * Six-cell one-time-code input.
 *
 * Mobile-first by design:
 * - `inputMode="numeric"` opens the number pad.
 * - `autoComplete="one-time-code"` lets iOS/Android offer the SMS/e-mail code,
 *   and a code dropped into one cell is spread across the remaining cells.
 * - Pasting "123456" (or "123 456") fills the whole code.
 * - Typing advances automatically, Backspace walks back, arrows move.
 *
 * The value is a single six-character string, so callers never deal with an
 * array and the API always receives a clean `\d{6}`.
 */
export function OtpCodeInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
  autoFocus = false,
  describedBy,
}: OtpCodeInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  function focusCell(index: number) {
    const target = Math.min(OTP_LENGTH - 1, Math.max(0, index));
    const input = inputs.current[target];
    if (!input) return;
    input.focus();
    input.select();
  }

  function commit(next: string[]) {
    onChange(next.join("").slice(0, OTP_LENGTH));
  }

  function handleChange(index: number, raw: string) {
    const previous = value[index] ?? "";
    const typed = raw.replace(/\D/g, "");
    const next = toDigits(value);

    if (!typed) {
      next[index] = "";
      commit(next);
      return;
    }

    // Typing over an already-filled cell (or an autofill that appends to it)
    // keeps only the new characters instead of shifting the whole code along.
    const incoming = previous && typed.startsWith(previous) ? typed.slice(previous.length) : typed;
    if (!incoming) return;

    let cursor = index;
    for (const digit of incoming) {
      if (cursor >= OTP_LENGTH) break;
      next[cursor] = digit;
      cursor += 1;
    }
    commit(next);
    focusCell(cursor);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      // A filled cell clears itself through handleChange; an empty one steps back.
      if (value[index]) return;
      event.preventDefault();
      const next = toDigits(value);
      if (index > 0) next[index - 1] = "";
      commit(next);
      focusCell(index - 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusCell(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusCell(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    event.preventDefault();
    commit(toDigits(digits));
    focusCell(digits.length);
  }

  return (
    <div
      role="group"
      aria-label={`${OTP_LENGTH}-digit verification code`}
      className="otp-row"
      onPaste={handlePaste}
    >
      {toDigits(value).map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          id={index === 0 ? "otp-code" : `otp-code-${index + 1}`}
          type="text"
          // `size={1}` keeps the intrinsic width at one character, so the cell
          // can shrink on narrow screens even before the stylesheet applies.
          size={1}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={index === OTP_LENGTH - 1 ? "done" : "next"}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          data-filled={digit ? "true" : "false"}
          style={{ animationDelay: `${index * 35}ms` }}
          className="otp-cell animate-cell"
        />
      ))}
    </div>
  );
}
