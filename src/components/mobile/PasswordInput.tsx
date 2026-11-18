"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Extra classes appended to the input (the toggle already reserves right padding). */
  inputClassName?: string;
};

/**
 * Password input with a built-in show/hide toggle.
 *
 * Every password field in the app must use this so the eye affordance is
 * consistent (sign-in, sign-up, student setup, confirm-password fields).
 * The toggle is `type="button"` so it never submits the surrounding form.
 */
export function PasswordInput({
  inputClassName = "",
  disabled,
  className,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`focus-ring min-h-[48px] w-full rounded-2xl border border-app-border bg-app-surface-2 px-4 pr-12 text-sm text-app-text placeholder:text-app-muted disabled:opacity-70 ${className ?? ""} ${inputClassName}`}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((prev) => !prev)}
        disabled={disabled}
        className="focus-ring absolute inset-y-0 right-2 flex items-center rounded-full px-2 text-app-muted transition hover:text-app-text disabled:opacity-70"
      >
        {visible ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
      </button>
    </div>
  );
}
