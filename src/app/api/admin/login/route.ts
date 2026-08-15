import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from '@/lib/auth/session';
import { safeEqual } from '@/lib/auth/secrets';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      return NextResponse.json(
        { message: 'Admin credentials not configured' },
        { status: 500 }
      );
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Evaluate both comparisons so the response time doesn't reveal which failed.
    const usernameMatches = safeEqual(username, adminUsername);
    const passwordMatches = safeEqual(password, adminPassword);

    if (!usernameMatches || !passwordMatches) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Signed session. Unlike the previous random token, this one is verifiable:
    // the server can tell it issued it, so a made-up cookie can't stand in.
    let sessionToken: string;
    try {
      sessionToken = await createSessionToken(adminUsername);
    } catch (error) {
      console.error('Cannot issue admin session:', error);
      return NextResponse.json(
        { message: 'Admin sessions are not configured on this deployment' },
        { status: 500 }
      );
    }

    cookies().set(ADMIN_SESSION_COOKIE, sessionToken, SESSION_COOKIE_OPTIONS);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
