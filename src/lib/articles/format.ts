/**
 * Score formatting for article surfaces.
 *
 * `toFixed(2)` on every score is wrong: `games` stores one decimal, so a stored
 * 104.0 would render as "104.00" and claim a hundredths digit the league does
 * not have. Sleeper's own figures do carry two (103.95), and the difference
 * between the two is exactly the kind of quiet fabrication the voice guide
 * bans elsewhere — "exact decimals, unrounded".
 *
 * So: show what the number actually has, with a one-decimal floor so a whole
 * number still reads as a score rather than a count.
 */
export function formatScore(value: number): string {
  const hundredths = Math.round(value * 100) % 10;
  return value.toFixed(hundredths === 0 ? 1 : 2);
}
