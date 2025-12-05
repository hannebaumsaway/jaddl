# Testing Playoff Export Functionality

## Quick Test (Recommended)

1. **Run the test script:**
   ```bash
   node test-playoff-export.js
   ```
   This checks if your database has the necessary data.

2. **Test the command-line export:**
   ```bash
   node export-playoff-data.js 2025 4
   ```
   Replace `2025` and `4` with your current year and week.

3. **Test via web interface:**
   - Start dev server: `pnpm dev`
   - Visit: http://localhost:3000/admin/login
   - Log in with admin credentials
   - Click "Playoff Export" tab
   - Select year/week and click "Export Data"
   - Verify the markdown output looks correct

## Detailed Testing Steps

### 1. Test API Endpoint Directly

**Using curl:**
```bash
# Get markdown output
curl "http://localhost:3000/api/export-playoff-data?year=2025" | jq -r .markdown

# Get JSON data
curl "http://localhost:3000/api/export-playoff-data?year=2025&week=4" | jq .
```

**Using browser:**
- Visit: http://localhost:3000/api/export-playoff-data?year=2025
- Should see JSON response with `markdown` and `data` fields

### 2. Test Command-Line Script

```bash
# Auto-detect current week
node export-playoff-data.js 2025

# Specify week
node export-playoff-data.js 2025 4

# Test with different years
node export-playoff-data.js 2024
```

### 3. Test Web Interface

1. **Start dev server:**
   ```bash
   pnpm dev
   ```

2. **Navigate to admin:**
   - Go to http://localhost:3000/admin/login
   - Log in (check your `.env.local` for `ADMIN_USERNAME` and `ADMIN_PASSWORD`)

3. **Test the export:**
   - Click "Playoff Export" tab
   - Select year (defaults to current year)
   - Select week or leave as "Auto"
   - Click "Export Data"
   - Verify:
     - ✅ Markdown appears in textarea
     - ✅ Copy button works
     - ✅ Data includes standings, head-to-head, remaining schedule
     - ✅ Division/Quad winners are marked with 🏆
     - ✅ Week 14 play-in scenario is shown (if week >= 13)

### 4. Verify Output Content

The export should include:

- ✅ **Header** with season, week, playoff structure
- ✅ **Current Standings** table with all teams
- ✅ **Division/Quad Standings** (if applicable)
- ✅ **Head-to-Head Records** for all matchups
- ✅ **Remaining Schedule** (weeks from current to 14)
- ✅ **Week 14 Play-in Scenario** (if week >= 13)
- ✅ **Tiebreaker Rules**

### 5. Test Edge Cases

**Test with no games:**
```bash
node export-playoff-data.js 2020 1
```

**Test with incomplete data:**
- Try years with no league_seasons entry
- Try years with no team_seasons

**Test division/quad detection:**
- Verify it correctly identifies quad winners vs division winners
- Check that BYE teams are marked correctly

### 6. Test Playoff Structure Logic

Verify the export correctly shows:

1. **Division/Quad Winners:**
   - Top team in each quad/division gets 🏆
   - Marked as "BYE (Week 14)" in standings

2. **Week 14 Play-in:**
   - Lists 4 division/quad winners with BYEs
   - Lists 8 teams in play-in
   - Notes that top 4 scorers advance

3. **Remaining Schedule:**
   - Week 14 games show which teams have BYEs
   - Other weeks show normal matchups

## Common Issues & Solutions

### Issue: "No quads or divisions found"
- **Cause:** Quads/divisions table might be empty for that year
- **Solution:** Check `team_seasons` table - teams might have `quad_id` but no corresponding quad record
- **Workaround:** Export will still work, just won't show division/quad standings

### Issue: API returns 500 error
- **Check:** Server logs for specific error
- **Common causes:**
  - Missing Supabase credentials
  - Database connection issues
  - Missing tables

### Issue: No data in export
- **Check:** Do you have games for that year?
- **Check:** Are games marked as `playoffs = false` for regular season?
- **Check:** Do teams have `team_seasons` entries for that year?

## Expected Output Format

The markdown should be formatted for easy pasting into ChatGPT:

```markdown
# Fantasy Football League Playoff Scenario Analysis

**Season:** 2025
**Current Week:** 4
**Total Teams:** 12
**Playoff Structure:**
- **Regular Season:** Weeks 1-13
- **Week 14 (Play-in Round):** 4 Quad winners get BYEs...
...

## Current Standings (Regular Season Only)
[Table with teams, records, points]

## Quad Standings
[If applicable]

## Head-to-Head Records
[All matchups]

## Remaining Schedule
[Weeks current to 14]

## Week 14 Play-in Scenario
[If week >= 13]
```

## Success Criteria

✅ Test passes if:
- No errors in console
- Markdown output is well-formatted
- All expected sections are present
- Division/Quad winners are correctly identified
- Week 14 scenario is accurate
- Copy button works in web interface
- Data matches what's in your database

## Next Steps After Testing

Once verified:
1. Use the export in the admin dashboard
2. Copy the markdown output
3. Paste into ChatGPT with a prompt like:
   > "Analyze these playoff scenarios. What needs to happen for each team to make the playoffs? Which teams are in the best/worst position?"


