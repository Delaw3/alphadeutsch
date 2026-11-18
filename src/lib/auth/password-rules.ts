/**
 * Shared password policy (client-safe, no server-only imports).
 *
 * The server is authoritative (`auth-errors.validateNewPassword`), and the auth
 * forms import the same rules so the live hint and the API error can never
 * drift apart or claim the wrong requirement is missing.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRequirementId = "length" | "lower" | "upper" | "digit" | "symbol";

export type PasswordRequirement = {
  id: PasswordRequirementId;
  /** Phrase used inside "Password needs …". */
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  {
    id: "length",
    label: `at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH && p.length <= PASSWORD_MAX_LENGTH,
  },
  { id: "upper", label: "an upper-case letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "a lower-case letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "a digit (0–9)", test: (p) => /[0-9]/.test(p) },
  { id: "symbol", label: "a symbol (like ! @ # $)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** Requirements the password does not satisfy yet, in a stable reading order. */
export function unmetPasswordRequirements(password: string): PasswordRequirement[] {
  return PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(password));
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Exact, actionable message naming only what is missing, e.g.
 *   "Password needs a symbol (like ! @ # $)."
 * Returns null when the password satisfies every rule.
 */
export function passwordRequirementMessage(password: string): string | null {
  const unmet = unmetPasswordRequirements(password);
  if (unmet.length === 0) return null;
  return `Password needs ${joinWithAnd(unmet.map((requirement) => requirement.label))}.`;
}
