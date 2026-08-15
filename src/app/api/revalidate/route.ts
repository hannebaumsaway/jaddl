import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { safeEqual } from '@/lib/auth/secrets';

export const dynamic = 'force-dynamic';

/**
 * Cache revalidation hook, called by Contentful (or by hand) after content
 * changes. Authenticated with a shared secret rather than an admin session,
 * since a webhook can't carry one.
 *
 * The secret is read from the `x-revalidate-secret` header first and falls back
 * to the `secret` query parameter for existing webhook configurations. Prefer
 * the header: query strings end up in server and proxy access logs.
 */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.REVALIDATE_SECRET;

  // Fail closed. Without a configured secret there is nothing to verify
  // against, so no caller can be authorized.
  if (!expected) return false;

  const provided =
    request.headers.get('x-revalidate-secret') ||
    new URL(request.url).searchParams.get('secret');

  if (!provided) return false;

  return safeEqual(provided, expected);
}

export async function POST(request: NextRequest) {
  try {
    // Previously this only ran when a secret was supplied, so omitting the
    // parameter entirely skipped the check and left the endpoint open.
    if (!isAuthorized(request)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');
    const path = searchParams.get('path');

    if (tag) {
      revalidateTag(tag);
      return NextResponse.json({ revalidated: true, tag, now: Date.now() });
    }

    if (path) {
      revalidatePath(path);
      return NextResponse.json({ revalidated: true, path, now: Date.now() });
    }

    return NextResponse.json(
      { message: 'Missing tag or path parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      {
        message: 'Error revalidating',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
