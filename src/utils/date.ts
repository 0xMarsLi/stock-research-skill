/**
 * Date helpers. The research report is stamped with the US-Eastern trading day,
 * since the agent runs against the US market regardless of the user's locale.
 */

/** Current date as ISO yyyy-mm-dd in America/New_York. */
export function easternToday(): string {
  // en-CA yields yyyy-mm-dd formatting.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** ISO date `n` days before now (UTC midnight basis — fine for lookback windows). */
export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Format a Date as yyyy-mm-dd (UTC). */
export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
