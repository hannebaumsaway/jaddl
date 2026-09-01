-- 005_rls_remaining_tables.sql
--
-- Finishes what 004 started.
--
-- 004 enumerated "every table the app touches" and enabled RLS on those 14.
-- The database has 18. The four it missed are legacy tables that predate the
-- current data layer, so they were not in front of anyone writing that list --
-- but PostgREST still exposes them, and with RLS off the anon key compiled into
-- the browser bundle can INSERT, UPDATE and DELETE in them. That is what
-- Supabase's rls_disabled_in_public advisor keeps mailing about.
--
--   franchise_history  read by getFranchiseNames() in src/lib/supabase/api.ts
--   articles           legacy index of the pre-Contentful archive; getArticles
--                      was deleted rather than repaired
--   quad_map           superseded by team_seasons.quad_id
--   schedule           superseded by games
--
-- Enumerating tables by hand is what caused this. After applying, run the
-- coverage check at the bottom -- it lists any public table still without RLS,
-- so a table added later shows up as a query result rather than as an email.

-- Re-runnable. The first attempt at this migration aborted on
-- "policy already exists" for franchise_history -- a `public read` policy was
-- there already, created outside 004 (most likely by the Resolve-issue flow in
-- the Supabase dashboard). Because the whole thing is one transaction, that
-- single error rolled back the other three tables too. Hence DROP ... IF EXISTS
-- before CREATE, so a partially-fixed database converges instead of aborting.

BEGIN;

-- Idempotent: enabling RLS on a table that already has it is not an error.
ALTER TABLE franchise_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quad_map          ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule          ENABLE ROW LEVEL SECURITY;

-- franchise_history is live: identity.ts resolves former franchise names
-- through it, so it needs the same public read as the 004 tables. Dropping
-- first makes this definitive rather than dependent on what is already there --
-- an existing policy of the same name may have been written by hand with a
-- different USING clause.
DROP POLICY IF EXISTS "public read" ON franchise_history;
CREATE POLICY "public read" ON franchise_history FOR SELECT USING (true);

-- The legacy three get no read policy. If the dashboard added one to any of
-- them, remove it -- nothing queries these tables, so public read is surface
-- with no purpose.
DROP POLICY IF EXISTS "public read" ON articles;
DROP POLICY IF EXISTS "public read" ON quad_map;
DROP POLICY IF EXISTS "public read" ON schedule;

-- With RLS on and no policy, those three deny everything including SELECT.
-- Nothing in the repo queries them -- verified by grepping for
-- from('articles' | 'quad_map' | 'schedule') across src/ and the root scripts.
-- If a page ever needs one back, the fix is one line:
--
--   CREATE POLICY "public read" ON articles FOR SELECT USING (true);
--
-- Reads fail soft through handleSupabaseError, so a missed consumer renders an
-- empty section rather than crashing the page.

COMMIT;

-- Verification.
--
-- 1. Coverage -- this should return zero rows. Any row is a table the anon key
--    can still write to. Re-run it after adding any table:
--
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND NOT rowsecurity
-- ORDER BY tablename;
--
-- 2. Policies -- franchise_history should have exactly one SELECT policy;
--    articles, quad_map and schedule should have none:
--
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('franchise_history','articles','quad_map','schedule');
--
-- 3. From the app: a team page must still show former franchise names, and
--    `pnpm dossier --verify` must pass -- both read franchise_history.
