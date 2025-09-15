import { NextResponse } from 'next/server';
import { validateImportSetup } from '@/lib/sleeper/import-service';

export async function GET() {
  try {
    const validation = await validateImportSetup();
    return NextResponse.json(validation);
  } catch (error) {
    console.error('Error validating setup:', error);
    return NextResponse.json(
      { error: 'Failed to validate setup' },
      { status: 500 }
    );
  }
}
