-- 004_row_level_security.sql
--
-- Locks the database down to read-only for the public key.
--
-- Why: NEXT_PUBLIC_SUPABASE_ANON_KEY is compiled into the JavaScript every
-- visitor to www.jaddl.com downloads — verified present in
-- .next/static/chunks/. No table had row-level security enabled and no policies
-- existed, so anyone could extract that key and INSERT, UPDATE or DELETE rows
-- in `games`, `teams` or `league_seasons` directly. Confirmed on 2026-08-25: an
-- UPDATE issued with the anon key returned no permission error.
--
-- That bypassed the admin auth entirely. The HMAC sessions in
-- src/lib/auth/session.ts and the gate in src/proxy.ts protect the import
-- endpoint; they never protected the database behind it.
--
-- After this migration the anon key can SELECT and nothing else. Writes must
-- present the service-role key, which has no NEXT_PUBLIC_ prefix and therefore
-- never reaches a browser bundle. The service role bypasses RLS by design, so
-- no write policies are needed.
--
-- RUN THIS ONLY AFTER SUPABASE_SERVICE_ROLE_KEY is set in .env.local and in
-- Vercel (Production and Preview). Applying it first will break score import,
-- playoff seeding and `pnpm sync-players` until the key exists.

BEGIN;

-- Every table the app touches. Enabling RLS with no policy denies everything;
-- the SELECT policy below is what keeps the public site working.
ALTER TABLE games          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_seasons   ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trophies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE trophy_case    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivalries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rivals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE playoff_seeds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_bios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_players    ENABLE ROW LEVEL SECURITY;

-- Public read. The site is public and every page reads with the anon key from
-- server components, so this has to stay permissive.
CREATE POLICY "public read" ON games          FOR SELECT USING (true);
CREATE POLICY "public read" ON teams          FOR SELECT USING (true);
CREATE POLICY "public read" ON team_seasons   FOR SELECT USING (true);
CREATE POLICY "public read" ON league_seasons FOR SELECT USING (true);
CREATE POLICY "public read" ON divisions      FOR SELECT USING (true);
CREATE POLICY "public read" ON quads          FOR SELECT USING (true);
CREATE POLICY "public read" ON trophies       FOR SELECT USING (true);
CREATE POLICY "public read" ON trophy_case    FOR SELECT USING (true);
CREATE POLICY "public read" ON rivalries      FOR SELECT USING (true);
CREATE POLICY "public read" ON rivals         FOR SELECT USING (true);
CREATE POLICY "public read" ON drafts         FOR SELECT USING (true);
CREATE POLICY "public read" ON playoff_seeds  FOR SELECT USING (true);
CREATE POLICY "public read" ON team_bios      FOR SELECT USING (true);
CREATE POLICY "public read" ON nfl_players    FOR SELECT USING (true);

-- Deliberately no INSERT/UPDATE/DELETE policies. Absent a policy, RLS denies
-- the action, which is the entire point. Do not add write policies for anon;
-- add the service-role key to whatever needs to write instead.

COMMIT;

-- Verification.
--
-- 1. Every table should report rowsecurity = true:
--
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY tablename;
--
-- 2. Each should have exactly one SELECT policy and no others:
--
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' ORDER BY tablename;
--
-- 3. From the app: public pages must still render, and an UPDATE with the anon
--    key must now fail. `node --env-file=.env.local` with the anon key:
--
--    await sb.from('games').update({ week: 1 }).eq('id', -1)
--
--    Before this migration that returned no error. After it, expect code 42501
--    (insufficient privilege) or a zero-row result with RLS blocking the write.
