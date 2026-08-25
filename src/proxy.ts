import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * Endpoints that must stay reachable without a session, or you could never log
 * in. Logout is public so a stale or invalid cookie can always be cleared.
 */
const PUBLIC_PATHS = new Set(['/admin/login', '/api/admin/login', '/api/admin/logout']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (session) {
    return NextResponse.next();
  }

  // API callers get a status they can act on; browsers get sent to the login page.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.redirect(new URL('/admin/login', request.url));
}

/**
 * The admin pages AND the admin APIs. The previous matcher excluded every
 * /api path, which left the API routes — including the import-scores write
 * endpoint — completely unauthenticated. analyze-db and test-supabase are
 * included because they expose table structures and sample rows.
 */
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/analyze-db/:path*',
    '/api/test-supabase/:path*',
  ],
};
