import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  try {
    const analysis: any = {};

    // 1. Analyze teams table structure and data
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('team_id');

    if (!teamsError) {
      analysis.teams = {
        count: teams?.length || 0,
        sample: teams?.slice(0, 3),
        structure: teams?.[0] ? Object.keys(teams[0]) : [],
        activeTeams: teams?.filter((t: any) => t.active).length || 0
      };
    }

    // 2. Analyze team_seasons to understand year-by-year changes
    const { data: teamSeasons, error: seasonsError } = await supabase
      .from('team_seasons')
      .select(`
        *,
        team:teams(team_id, team_name, short_name)
      `)
      .order('year', { ascending: false })
      .order('team_id');

    if (!seasonsError) {
      analysis.teamSeasons = {
        count: teamSeasons?.length || 0,
        years: Array.from(new Set(teamSeasons?.map((ts: any) => ts.year) || [])).sort((a, b) => b - a),
        sample: teamSeasons?.slice(0, 5),
        structure: teamSeasons?.[0] ? Object.keys(teamSeasons[0]) : []
      };
    }

    // 3. Analyze games table structure and scoring patterns
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .order('year', { ascending: false })
      .order('week');

    if (!gamesError) {
      analysis.games = {
        count: games?.length || 0,
        years: Array.from(new Set(games?.map((g: any) => g.year) || [])).sort((a, b) => b - a),
        weeks: Array.from(new Set(games?.map((g: any) => g.week) || [])).sort((a, b) => a - b),
        sample: games?.slice(0, 5),
        structure: games?.[0] ? Object.keys(games[0]) : [],
        scoringStats: games?.reduce((stats: any, game: any) => {
          if (game.home_score !== null && game.away_score !== null) {
            stats.totalGames++;
            stats.totalPoints += (game.home_score + game.away_score);
            stats.highestScore = Math.max(stats.highestScore, game.home_score, game.away_score);
            stats.lowestScore = Math.min(stats.lowestScore, game.home_score, game.away_score);
          }
          return stats;
        }, { totalGames: 0, totalPoints: 0, highestScore: 0, lowestScore: 999999 })
      };
    }

    // 4. Analyze league_seasons to understand structure changes
    const { data: leagueSeasons, error: leagueError } = await supabase
      .from('league_seasons')
      .select('*')
      .order('year', { ascending: false });

    if (!leagueError) {
      analysis.leagueSeasons = {
        count: leagueSeasons?.length || 0,
        sample: leagueSeasons?.slice(0, 3),
        structure: leagueSeasons?.[0] ? Object.keys(leagueSeasons[0]) : [],
        structureEvolution: leagueSeasons?.map((ls: any) => ({
          year: ls.year,
          structure: ls.structure_type,
          teamCount: ls.team_count,
          divisionCount: ls.division_count
        }))
      };
    }

    // 5. Check for divisions and quads tables
    const { data: divisions, error: divError } = await supabase
      .from('divisions')
      .select('*')
      .limit(5);

    if (!divError) {
      analysis.divisions = {
        exists: true,
        count: divisions?.length || 0,
        sample: divisions?.slice(0, 3),
        structure: divisions?.[0] ? Object.keys(divisions[0]) : []
      };
    } else {
      analysis.divisions = { exists: false, error: divError.message };
    }

    const { data: quads, error: quadError } = await supabase
      .from('quads')
      .select('*')
      .limit(5);

    if (!quadError) {
      analysis.quads = {
        exists: true,
        count: quads?.length || 0,
        sample: quads?.slice(0, 3),
        structure: quads?.[0] ? Object.keys(quads[0]) : []
      };
    } else {
      analysis.quads = { exists: false, error: quadError.message };
    }

    // 6. Analyze how teams are mapped to divisions/quads over time
    if (teamSeasons && teamSeasons.length > 0) {
      const divisionMapping = teamSeasons.reduce((acc: any, ts: any) => {
        if (!acc[ts.year]) acc[ts.year] = {};
        if (!acc[ts.year][ts.division_id]) acc[ts.year][ts.division_id] = [];
        acc[ts.year][ts.division_id].push(ts.team_id);
        return acc;
      }, {} as any);

      const quadMapping = teamSeasons.reduce((acc: any, ts: any) => {
        if (!acc[ts.year]) acc[ts.year] = {};
        if (!acc[ts.year][ts.quad_id]) acc[ts.year][ts.quad_id] = [];
        acc[ts.year][ts.quad_id].push(ts.team_id);
        return acc;
      }, {} as any);

      analysis.teamMappings = {
        divisionMapping,
        quadMapping,
        yearsWithDivisions: Object.keys(divisionMapping).filter(year => 
          Object.keys(divisionMapping[year]).some(divId => divId !== null)
        ),
        yearsWithQuads: Object.keys(quadMapping).filter(year => 
          Object.keys(quadMapping[year]).some(quadId => quadId !== null)
        )
      };
    }

    // 7. Check for any other relevant tables
    const { data: tableList } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    analysis.availableTables = tableList?.map((t: any) => t.table_name) || [];

    return NextResponse.json({
      message: 'Database analysis complete',
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to analyze database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
