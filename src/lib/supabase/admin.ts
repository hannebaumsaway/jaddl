/**
 * Service-role Supabase client, for writes only.
 *
 * The anon key in `client.ts` is `NEXT_PUBLIC_`, so it is compiled into the
 * JavaScript every visitor downloads. That is fine for reading a public site,
 * and not fine for writing: with row-level security enabled and no write
 * policy, the anon key can read but not modify anything, and every write has to
 * present this key instead.
 *
 * SUPABASE_SERVICE_ROLE_KEY has no `NEXT_PUBLIC_` prefix, so Next will not
 * inline it into a client bundle. It also bypasses row-level security entirely,
 * which is exactly why it must never be imported into a client component.
 *
 * Unlike `client.ts` this does NOT throw at import time. Modules holding a
 * write path are imported by pages that only ever read, and failing at import
 * would take down the public site on a misconfigured deploy rather than just
 * the admin surface.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * The write client. Throws when called without a service-role key configured,
 * or if it is ever reached from the browser.
 */
export function getAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'getAdminClient() was called in the browser. The service-role key must ' +
      'never reach a client bundle — move this call into a server component, ' +
      'route handler or script.'
    );
  }

  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Writes require SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL). ' +
      'Row-level security blocks writes from the anon key. Add the service role ' +
      'key from Supabase → Project Settings → API to .env.local and to Vercel ' +
      '(Production and Preview). Never prefix it with NEXT_PUBLIC_.'
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Whether a service-role key is configured, for diagnostics and admin UI. */
export function hasAdminCredentials(): boolean {
  return (
    typeof window === 'undefined' &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
