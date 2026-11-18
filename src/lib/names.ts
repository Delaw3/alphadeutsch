/**
 * Student names are captured as "Surname First name Other name(s)" — for example
 * "Muodum Laurent Chukwuebuka". The first word is the family name, so the name we
 * greet people with is the second word: their first name ("Laurent").
 *
 * Falls back to the only word when a single name was given, and to an empty
 * string otherwise, so callers can supply their own default.
 */
export function givenName(fullName?: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.length > 1 ? parts[1] : parts[0];
}
