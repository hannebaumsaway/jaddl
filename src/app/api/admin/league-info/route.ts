import { NextResponse } from 'next/server';
import { getLeagueInfo, getLeagueUsers, getNFLState } from '@/lib/sleeper/api';

export async function GET() {
  try {
    const [leagueInfo, users, nflState] = await Promise.all([
      getLeagueInfo(),
      getLeagueUsers(),
      getNFLState()
    ]);

    return NextResponse.json({
      league: leagueInfo,
      users: users,
      nflState: nflState,
      currentSeason: nflState?.season || new Date().getFullYear(),
      currentWeek: nflState?.week || 1
    });
  } catch (error) {
    console.error('Error fetching league info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch league information' },
      { status: 500 }
    );
  }
}
