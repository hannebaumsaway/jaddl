-- 002_2026_season.sql
--
-- Sets up the 2026 season: back to 2 divisions (East/West) after the 2019-2025
-- quad era. Run this in the Supabase SQL Editor before importing Week 1.
--
-- Division assignments below mirror the Sleeper league (id 1389689970226126848,
-- settings.divisions = 2), where division_1 = East and division_2 = West.
-- The existing divisions rows are reused: division_id 1 = East, 2 = West.
--
-- NOTE: adding the league_seasons row immediately makes 2026 the "current"
-- season for the home page (getCurrentSeason picks the max year), so that page
-- will read empty until Week 1 games are imported.

BEGIN;

-- 1. League season row. structure_type drives division vs quad grouping in
--    calculateStandings; division_count is the number of groups.
INSERT INTO league_seasons (year, structure_type, division_count, team_count, notes)
VALUES (
  2026,
  'divisions',
  2,
  12,
  'Returned to 2 divisions (East/West) after the 2019-2025 quad era. 6-team playoff field: 2 division winners get byes, 4 wildcards by record.'
);

-- 2. Team assignments. quad_id stays NULL so the divisions path is used.
--    East (division_id 1)
INSERT INTO team_seasons (team_id, year, division_id, quad_id) VALUES
  (1,  2026, 1, NULL),  -- Fightin' Longshanks   (Sleeper roster 1)
  (2,  2026, 1, NULL),  -- Mighty Boom           (Sleeper roster 11)
  (3,  2026, 1, NULL),  -- Bad News Bensons      (Sleeper roster 7)
  (4,  2026, 1, NULL),  -- Lawrence Football Jesus (Sleeper roster 6)
  (5,  2026, 1, NULL),  -- Team Odouls           (Sleeper roster 9)
  (6,  2026, 1, NULL),  -- Millennium Falcons    (Sleeper roster 10)
--    West (division_id 2)
  (7,  2026, 2, NULL),  -- Tulsa Angry Monkeys   (Sleeper roster 12)
  (8,  2026, 2, NULL),  -- In Pursuit of Perfection (Sleeper roster 3)
  (10, 2026, 2, NULL),  -- Team Hauloll          (Sleeper roster 2)
  (11, 2026, 2, NULL),  -- Red Hornets           (Sleeper roster 8)
  (12, 2026, 2, NULL),  -- Lanniesters           (Sleeper roster 4)
  (17, 2026, 2, NULL);  -- Nate's Dinos or Whoever (Sleeper roster 5)

COMMIT;

-- Verification: expect 6 teams per division.
-- SELECT d.division_name, COUNT(*) AS teams
-- FROM team_seasons ts JOIN divisions d ON d.division_id = ts.division_id
-- WHERE ts.year = 2026 GROUP BY d.division_name;
