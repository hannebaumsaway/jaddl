import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  try {
    // Test what tables actually exist and what data we can fetch
    const results: any = {};

    // Try different table names that might exist
    const tablesToTry = [
      'teams',
      'team_seasons', 
      'games',
      'matchups',
      'scores',
      'standings',
      'league_seasons',
      'seasons',
      'weekly_scores',
      'team_records',
      'survivor'
    ];

    for (const tableName of tablesToTry) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(3);
        
        if (!error) {
          results[tableName] = {
            exists: true,
            sampleData: data,
            count: data?.length || 0
          };
        } else {
          results[tableName] = {
            exists: false,
            error: error.message
          };
        }
      } catch (err) {
        results[tableName] = {
          exists: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json({
      message: 'Supabase connection test',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to test Supabase connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
