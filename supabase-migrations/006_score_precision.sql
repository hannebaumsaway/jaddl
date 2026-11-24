-- 006_score_precision.sql
--
-- Stores game scores to two decimals.
--
-- games.home_score / away_score were DECIMAL(5,1). Sleeper scores to the
-- hundredth (half-point PPR plus fractional yardage), so every score imported
-- since the league moved to Sleeper in 2022 was rounded on insert -- 303 of the
-- 402 regular-season games from 2022 through 2026 Week 11 lost a digit. Two of
-- them lost the result as well: a 0.05-point win rounded both sides to the same
-- tenth and was recorded as a tie.
--
--   2023 Week 2   In Pursuit of Perfection 126.70, Mighty Boom 126.65
--   2026 Week 9   Team Hauloll 112.20, Millennium Falcons 112.15
--
-- Those are the only two ties stored since 2022. Neither was real.
--
-- Widening the scale is lossless: every existing one-decimal value is
-- representable unchanged, so pre-Sleeper seasons (recorded to one decimal at
-- the source) are untouched. The missing hundredths are restored afterwards by
-- `pnpm backfill-scores --apply`, which reads them back from Sleeper. Run this
-- first -- against the old column the backfill's writes would just be rounded
-- again, and the script stops when it sees that happen.

-- 1. Confirm the current type. Expect numeric, precision 5, scale 1.
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'games'
  AND column_name IN ('home_score', 'away_score');

-- 2. Widen. NUMERIC(6,2) holds up to 9999.99. ALTER ... TYPE fails if a view
--    depends on these columns; the error names the view, which would need to be
--    dropped and recreated around this statement.
BEGIN;

ALTER TABLE public.games
  ALTER COLUMN home_score TYPE NUMERIC(6,2),
  ALTER COLUMN away_score TYPE NUMERIC(6,2);

COMMIT;

-- 3. Re-run the query from step 1. Expect precision 6, scale 2.
