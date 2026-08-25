import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Session check for the dashboard. Middleware already rejects unauthenticated
 * requests to this path; verifying again here means the answer stays correct
 * even if the matcher changes, rather than relying on one layer.
 */
export async function GET() {
  const session = await verifySessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ message: 'Invalid session' }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, expiresAt: session.exp });
}
