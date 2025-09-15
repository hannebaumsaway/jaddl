# JADDL Development Log

## Recent Updates (Latest Session)

### 🏠 Home Page Transformation
**File**: `src/app/(pages)/page.tsx`

**Changes Made**:
- ✅ **Replaced dummy data with real data** from Supabase and Contentful
- ✅ **Added JADDL logo** to hero section (replaced trophy icon)
- ✅ **Updated title** from "Welcome to JADDL" to "Welcome to The JADDL"
- ✅ **Removed hero description** paragraph for cleaner look
- ✅ **Added Latest News section** with 3 most recent articles from Contentful
- ✅ **Added Current Standings section** showing all 4 quad standings
- ✅ **Removed League Overview section** (stats cards at bottom)
- ✅ **Enhanced news cards** with full-bleed featured images (w-32, h-32)
- ✅ **Fixed Contentful API** - changed from `getNewsArticles` to `getJaddlArticles`

**Technical Details**:
- Uses `getJaddlArticles(3, 0)` for recent news
- Uses `calculateStandings(currentYear)` for current standings
- Integrates Contentful team profiles with Supabase data
- News cards have full-bleed images with proper padding on content area

### 🦶 Footer Updates
**File**: `src/components/layout/Footer.tsx`

**Changes Made**:
- ✅ **Replaced left section** (trophy icon + text + description) with large JADDL logo
- ✅ **Logo size**: `h-32` (128px height) for prominent display
- ✅ **Uses**: `/images/jaddl-nav-logo-dark.svg`

### 📊 Standings Page Enhancements
**File**: `src/app/(pages)/standings/page.tsx`

**Changes Made**:
- ✅ **Added Division/Quad Records** to standings tables
- ✅ **Dynamic structure detection** from `league_seasons.structure_type`
- ✅ **Fixed division record calculation** (excludes playoff games)
- ✅ **Implemented tiebreaker order**: 1. overall record, 2. division/quad record, 3. points scored
- ✅ **Updated table headers** to "Div W", "Div L", "Div T" (always "Div" regardless of quads/divisions)
- ✅ **Made division columns sortable**

**Technical Details**:
- `calculateStandings()` now calculates `division_wins`, `division_losses`, `division_ties`, `quad_wins`, `quad_losses`, `quad_ties`
- Division/quad records exclude playoff games (`!game.playoffs`)
- `SimpleStandingsTable` shows compact format: "W-L-T (Div W-L-T)"

### 📜 History Page Updates
**File**: `src/app/(pages)/history/page.tsx`

**Changes Made**:
- ✅ **Dynamic Milestones** from `league_seasons` table (only years with notes)
- ✅ **Dynamic Rivalries** from `rivalries` and `rivals` tables
- ✅ **Added All-Time Win %** section (formatted as ".###")
- ✅ **Added All-Time PPG** section
- ✅ **Added Streaks section** (longest win/losing streaks)
- ✅ **Team name links** to team detail pages
- ✅ **Active team filtering** (only 12 active teams from Contentful)
- ✅ **Streak calculation** spans across years with proper date formatting
- ✅ **Added thumbs up/down icons** for streak headers

**Technical Details**:
- Uses `getLeagueHistory()` from `src/lib/supabase/history.ts`
- Streaks show format: "2020 wk 10 - 2021 wk 7"
- All team names are clickable links to `/teams/${teamId}`
- Win % excludes current season from calculation

## 🔧 Technical Architecture

### Data Sources
- **Supabase**: Games, teams, standings, league seasons, rivalries
- **Contentful**: Team profiles, news articles, logos, active status

### Key Functions
- `calculateStandings(year)` - Main standings calculation
- `getJaddlArticles(limit, offset)` - News articles from Contentful
- `getLeagueHistory()` - Comprehensive history data
- `enrichTeamsWithSupabaseData()` - Combines Contentful + Supabase team data

### File Structure
```
src/
├── app/(pages)/
│   ├── page.tsx              # Home page
│   ├── standings/page.tsx    # Standings page
│   └── history/page.tsx      # History page
├── components/
│   ├── layout/Footer.tsx     # Global footer
│   └── standings/            # Standings components
├── lib/
│   ├── supabase/api.ts       # Supabase data functions
│   ├── supabase/history.ts   # History-specific functions
│   └── contentful/api.ts     # Contentful data functions
└── types/
    ├── database.ts           # Supabase types
    └── contentful.ts         # Contentful types
```

## 🎨 Design Decisions

### Logo Usage
- **Home page hero**: JADDL logo (h-16)
- **Footer**: Large JADDL logo (h-32)
- **File**: `/images/jaddl-nav-logo-dark.svg`

### Color Scheme
- Primary: Light Blue (#1E64FF) for hovers/active states
- Avoid: Yellow and orange colors
- Background: Blues, grays, with accent color

### Typography
- **Fonts**: Geist and Geist Mono (preferred over Inter/JetBrains)
- **Numbers**: Geist Mono for stats and numbers

### UI Components
- **Theme**: "Mono" theme for Shadcn/ui components
- **Styling**: Tailwind CSS classes (no inline styles)
- **Icons**: Lucide React icons
- **No colored emojis** in UI components

## 🐛 Known Issues & Fixes

### Fixed Issues
1. **Contentful API Error**: `getNewsArticles` used non-existent content type → Fixed with `getJaddlArticles`
2. **Division Records Showing 0s**: Fixed by excluding playoff games and proper data mapping
3. **Team Mapping Error**: Fixed by passing all required parameters to `enrichTeamsWithSupabaseData`
4. **Standings Structure**: Fixed `leagueStructure is not defined` error

### Current Warnings
- **Viewport metadata warning**: "Unsupported metadata viewport is configured in metadata export"
- **Solution**: Move viewport to separate `viewport` export (Next.js 14+ requirement)

## 🚀 Next Steps & Recommendations

### Immediate
1. Fix viewport metadata warning in layout files
2. Test all pages for responsive design
3. Verify all team links work correctly

### Future Enhancements
1. Add more dynamic content to home page
2. Implement search functionality
3. Add user authentication
4. Create admin dashboard for content management

## 📝 Development Notes

### Database Schema
- `league_seasons`: Contains `structure_type` (single_league, divisions, quads)
- `games`: Contains `playoffs` flag for filtering
- `team_seasons`: Links teams to divisions/quads for each season
- `rivalries` + `rivals`: Historic rivalry data

### Performance Considerations
- All data fetching is server-side (Next.js App Router)
- Contentful and Supabase calls are parallelized with `Promise.all()`
- Team data is enriched once and reused across components

---

**Last Updated**: Current session
**Status**: ✅ All major features implemented and working
**Next Session**: Ready for new features or refinements
