/**
 * Score formatting for article surfaces.
 *
 * Precision depends on the era. Sleeper scores (2022 on) carry hundredths,
 * stored since migration 006. Earlier seasons were recorded to one decimal. So
 * neither fixed width is right: `toFixed(2)` renders a pre-Sleeper 104.0 as
 * "104.00", claiming a digit the league does not have, and `toFixed(1)` renders
 * 112.15 as "112.2", which drew 2026 Week 9's 0.05-point win as a tie. Both are
 * the kind of quiet fabrication the voice guide bans: "exact decimals,
 * unrounded".
 *
 * So: show what the number actually has, with a one-decimal floor so a whole
 * number still reads as a score rather than a count. Fine for margins too,
 * since the difference of two scores has no more digits than either.
 */
export function formatScore(value: number): string {
  const hundredths = Math.round(value * 100) % 10;
  return value.toFixed(hundredths === 0 ? 1 : 2);
}
