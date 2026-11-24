/**
 * Score formatting, for every surface that lists a game score or margin.
 *
 * Precision is a property of the SEASON, not of the number. Sleeper (2022 on)
 * scores to the hundredth, stored since migration 006, so every score of that
 * era has two decimals, including the ones whose hundredths digit is zero:
 * 112.20–112.15, never 112.2–112.15. Earlier seasons were recorded to one
 * decimal, so padding a 2010 104.0 to "104.00" would claim a digit the league
 * never had.
 *
 * Deriving the width from the value instead (trim a trailing zero) is what this
 * replaced. It made a 2026 score read "112.2" beside "112.15" in the same game,
 * which looks like a pre-Sleeper number and invites the question of which one
 * was rounded.
 *
 * Margins, highs, lows and per-game averages take the same width as the scores
 * they come from. Season totals are a different kind of number and keep their
 * own formatting.
 */

/** First season recorded to the hundredth (the league's first on Sleeper). */
export const FIRST_HUNDREDTHS_SEASON = 2022;

export function scoreDecimals(year: number): 1 | 2 {
  return year >= FIRST_HUNDREDTHS_SEASON ? 2 : 1;
}

export function formatScore(value: number, year: number): string {
  return value.toFixed(scoreDecimals(year));
}
