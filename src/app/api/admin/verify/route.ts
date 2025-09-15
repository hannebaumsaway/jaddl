import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('admin-session');

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'No session found' },
        { status: 401 }
      );
    }

    // In a real application, you would verify the session token
    // against a database or session store. For simplicity, we'll
    // just check if the token exists and has the right format.
    if (sessionToken.value && sessionToken.value.length === 64) {
      return NextResponse.json({ authenticated: true });
    } else {
      return NextResponse.json(
        { message: 'Invalid session' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
