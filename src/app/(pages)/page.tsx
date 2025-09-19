import React from 'react';
import { Metadata } from 'next';
import { Trophy, TrendingUp, Calendar, Users, Award } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ClientLogo } from '@/components/ui/client-logo';
import { getJaddlArticles, getTeamProfiles } from '@/lib/contentful/api';
import { getCurrentSeason, calculateStandings, getTeams } from '@/lib/supabase/api';
import { supabase } from '@/lib/supabase/client';
import { SimpleStandingsTable } from '@/components/standings/SimpleStandingsTable';
import { enrichTeamsWithSupabaseData } from '@/lib/utils/team-mapping';
import { generateArticleSlug } from '@/lib/utils/slug';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Welcome to JADDL Fantasy Football League - Your premier destination for fantasy football competition.',
};

export default async function HomePage() {
  try {
    // Fetch data sequentially to avoid response conflicts
    const currentSeason = await getCurrentSeason();
    const recentArticles = await getJaddlArticles(5, 0);
    const teamProfiles = await getTeamProfiles();
    const supabaseTeams = await getTeams();

    const currentYear = currentSeason?.year || new Date().getFullYear();
    
    // Get current week from the most recent game
    const { data: latestGame } = await supabase
      .from('games')
      .select('week')
      .eq('year', currentYear)
      .order('week', { ascending: false })
      .limit(1)
      .single();
    
    const currentWeek = (latestGame as any)?.week || 1;
    
    // Get current standings
    const standings = await calculateStandings(currentYear);
    
    // Create team lookup for standings display
    const enrichedTeams = enrichTeamsWithSupabaseData(teamProfiles, supabaseTeams);
    const teamLookup = new Map(enrichedTeams.map(team => [team.teamId, team]));
    
    // Determine structure type for display
    const structureType = currentSeason?.structure_type || 'single_league';
    const structureLabel = structureType === 'quads' ? 'Quads' : 'Divisions';
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <div className="flex justify-center mb-6">
          <ClientLogo 
            type="logo"
            alt="JADDL Logo - Fantasy Football League" 
            className="h-16 w-auto"
            style={{ maxWidth: '200px' }}
          />
        </div>
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
          Welcome to The JADDL
        </h1>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button variant="league" size="lg" asChild>
            <Link href="/standings">
              <TrendingUp className="h-5 w-5 mr-2" />
              View Standings
            </Link>
          </Button>
          <Button variant="league-outline" size="lg" asChild>
            <Link href="/scores">
              <Calendar className="h-5 w-5 mr-2" />
              This Week&apos;s Scores
            </Link>
          </Button>
        </div>
      </section>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Featured News */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Latest News</h2>
            <Button variant="ghost" asChild>
              <Link href="/news">View All</Link>
            </Button>
          </div>
           <div className="space-y-4">
             {recentArticles.map((article) => (
               <Link 
                 key={article.id} 
                 href={`/news/${generateArticleSlug(article.title, article.year, article.week)}`}
                 className="block"
               >
                 <Card className="hover:shadow-md transition-shadow overflow-hidden p-0 cursor-pointer">
                   <div className="flex h-40">
                     {/* Featured Image - Full bleed to card edges */}
                     <div className="flex-shrink-0">
                       {article.featuredImage ? (
                         <img
                           src={article.featuredImage.url}
                           alt={article.featuredImage.alt || article.title}
                           className="w-32 h-full object-cover"
                         />
                       ) : (
                         <div className="w-32 h-full bg-muted flex items-center justify-center">
                           <span className="text-muted-foreground text-xs">No Image</span>
                         </div>
                       )}
                     </div>
                     
                     {/* Content */}
                     <div className="flex-1 min-w-0 py-6 px-4">
                       <div className="flex items-center justify-between mb-3">
                         <span className="text-xs font-medium text-foreground uppercase tracking-wide">
                           {article.isPlayoff ? 'Playoffs' : 'Regular Season'}
                         </span>
                         <span className="text-xs text-muted-foreground">
                           {article.year} Week {article.week}
                         </span>
                       </div>
                       <h3 className="text-lg font-semibold leading-tight mb-3 hover:text-primary transition-colors">
                         {article.title}
                       </h3>
                       <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                         {article.subtitle || 'Read the full article for more details...'}
                       </p>
                       {article.tags.length > 0 && (
                         <div className="flex flex-wrap gap-1">
                           {article.tags.slice(0, 3).map((tag) => (
                             <span key={tag} className="text-xs bg-muted px-2 py-1 rounded">
                               {tag}
                             </span>
                           ))}
                         </div>
                       )}
                     </div>
                   </div>
                 </Card>
               </Link>
             ))}
          </div>
        </section>

        {/* Current Standings */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Current Standings</h2>
            <Button variant="ghost" asChild>
              <Link href="/standings">View Full Standings</Link>
            </Button>
          </div>
          <div className="space-y-4">
            {structureType === 'quads' && standings.quads ? (
              Object.entries(standings.quads).map(([quadName, quadStandings]) => (
                <SimpleStandingsTable
                  key={quadName}
                  title={quadName}
                  records={quadStandings as any[]}
                  teamLookup={teamLookup}
                  isSubTable
                />
              ))
            ) : structureType === 'divisions' && standings.divisions ? (
              Object.entries(standings.divisions).map(([divisionName, divisionStandings]) => (
                <SimpleStandingsTable
                  key={divisionName}
                  title={divisionName}
                  records={divisionStandings as any[]}
                  teamLookup={teamLookup}
                  isSubTable
                />
              ))
            ) : (
              <SimpleStandingsTable
                title="Overall Standings"
                records={standings.overall}
                teamLookup={teamLookup}
                isSubTable
              />
            )}
          </div>
        </section>
      </div>


      {/* Quick Actions */}
      <section className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Quick Actions</h2>
        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="league-outline" asChild>
            <Link href="/teams">Browse Teams</Link>
          </Button>
          <Button variant="league-outline" asChild>
            <Link href="/history">League History</Link>
          </Button>
          <Button variant="league-outline" asChild>
            <Link href="/standings">Current Standings</Link>
          </Button>
          <Button variant="league-outline" asChild>
            <Link href="/news">Latest News</Link>
          </Button>
        </div>
      </section>
    </div>
  );
  } catch (error) {
    console.error('Error loading home page data:', error);
    // Return a fallback UI if data loading fails
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <section className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <ClientLogo 
              type="logo"
              alt="JADDL Logo - Fantasy Football League" 
              className="h-16 w-auto"
              style={{ maxWidth: '200px' }}
            />
          </div>
          <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
            Welcome to The JADDL
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Loading league data...
          </p>
        </section>
      </div>
    );
  }
}
