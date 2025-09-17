import React from 'react';
import { Metadata } from 'next';
import { Trophy } from 'lucide-react';

import { getCurrentSeason, calculateStandings, getLeagueSeasons } from '@/lib/supabase/api';
import { getTeamProfiles } from '@/lib/contentful/api';
import { enrichTeamsWithSupabaseData } from '@/lib/utils/team-mapping';
import NavigationControls from '@/components/standings/NavigationControls';
import { StandingsDataTable } from '@/components/standings/StandingsDataTable';
import { SimpleStandingsTable } from '@/components/standings/SimpleStandingsTable';

export const metadata: Metadata = {
  title: 'Standings',
  description: 'Current league standings and team rankings for the JADDL fantasy football league.',
};

interface StandingsPageProps {
  searchParams: { year?: string };
}

export default async function StandingsPage({ searchParams }: StandingsPageProps) {
  // Get season year from URL or current season
  const urlYear = searchParams.year ? parseInt(searchParams.year) : null;
  const currentSeason = await getCurrentSeason();
  const seasonYear = urlYear || currentSeason?.year || 2024;

  // Fetch data
  const contentfulTeams = await getTeamProfiles();
  const standings = await calculateStandings(seasonYear);
  
  // Get league structure info for this specific year
  const leagueSeasons = await getLeagueSeasons();
  const currentLeagueSeason = leagueSeasons.find(ls => ls.year === seasonYear);
  
  // Get available years from league_seasons data
  const availableYears = leagueSeasons.map(ls => ls.year).sort((a, b) => b - a);

  // Determine league structure for this year
  const hasQuads = standings.quads && Object.keys(standings.quads).length > 0;
  const hasDivisions = standings.divisions && Object.keys(standings.divisions).length > 0;
  const structureType = currentLeagueSeason?.structure_type || (hasQuads ? 'quads' : hasDivisions ? 'divisions' : 'single_league');
  const structureLabel = structureType === 'quads' ? 'Quad' : structureType === 'divisions' ? 'Division' : 'Overall';

  // Enrich standings with Contentful data
  const enrichedTeams = enrichTeamsWithSupabaseData(
    contentfulTeams,
    [], // We'll use team records for matching instead
    standings.overall
  );

  // Create mapping for quick lookup using teamId (which should match team_id in records)
  const teamLookup = new Map(enrichedTeams.map(team => [team.teamId, team]));

  // Get navigation info
  const sortedYears = availableYears.sort((a: number, b: number) => b - a);
  const currentIndex = sortedYears.indexOf(seasonYear);
  const prevYear = currentIndex < sortedYears.length - 1 ? sortedYears[currentIndex + 1] : null;
  const nextYear = currentIndex > 0 ? sortedYears[currentIndex - 1] : null;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header with Navigation */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">League Standings</h1>
        <p className="text-lg text-muted-foreground mb-6">
          {seasonYear} Season • {structureLabel} Structure
        </p>
        <NavigationControls
          currentYear={seasonYear}
          prevYear={prevYear}
          nextYear={nextYear}
          availableYears={availableYears}
        />
      </div>

      {/* Standings Content */}
      {!standings.overall || standings.overall.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Data Available</h3>
          <p className="text-muted-foreground">
            No standings data found for the {seasonYear} season.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {/* Division Standings - Show First */}
            {hasDivisions && !hasQuads && standings.divisions && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground text-center">Division Standings</h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {Object.entries(standings.divisions).map(([divisionName, divisionRecords]) => (
                    <SimpleStandingsTable
                      key={divisionName}
                      title={divisionName}
                      records={divisionRecords as any[]}
                      teamLookup={teamLookup}
                      isSubTable
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quad Standings - Show First */}
            {hasQuads && standings.quads && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground text-center">Quad Standings</h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {Object.entries(standings.quads).map(([quadName, quadRecords]) => (
                    <SimpleStandingsTable
                      key={quadName}
                      title={quadName}
                      records={quadRecords as any[]}
                      teamLookup={teamLookup}
                      isSubTable
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Overall Standings - Show After Divisions/Quads with extra spacing */}
          <div className="pt-16">
            <StandingsDataTable 
              title="Overall Standings"
              records={standings.overall}
              teamLookup={teamLookup}
            />
          </div>
        </>
      )}
    </div>
  );
}