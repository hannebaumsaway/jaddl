import { NextRequest, NextResponse } from 'next/server';
import { importWeekScores } from '@/lib/sleeper/import-service';

export async function POST(request: NextRequest) {
  try {
    const { year, week } = await request.json();

    if (!year || !week) {
      return NextResponse.json(
        { error: 'Year and week are required' },
        { status: 400 }
      );
    }

    if (week < 1 || week > 18) {
      return NextResponse.json(
        { error: 'Week must be between 1 and 18' },
        { status: 400 }
      );
    }

    const result = await importWeekScores(year, week);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Error in import-scores API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
