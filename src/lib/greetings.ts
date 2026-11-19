/**
 * German greetings used across the app.
 *
 * The school teaches German, so the app greets students in German even though
 * the rest of the interface is English. `Hallo` is the neutral greeting used in
 * page titles; the app bar uses the time of day.
 */

/** Time-of-day greeting for an hour of the day (0–23). */
export function greetingForHour(hour: number): string {
  const h = Number.isFinite(hour) ? ((Math.trunc(hour) % 24) + 24) % 24 : 0;
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

/** Time-of-day greeting for the device's local time. */
export function greetingForNow(now: Date = new Date()): string {
  return greetingForHour(now.getHours());
}
