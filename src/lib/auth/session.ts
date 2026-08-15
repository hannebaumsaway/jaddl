/**
 * Admin session tokens.
 *
 * Sessions are stateless and signed: the cookie carries a payload plus an
 * HMAC-SHA256 signature over it, so the server can verify a session it issued
 * without storing anything. The previous implementation generated a random
 * token, never recorded it, and checked only that the cookie was 64 characters
 * long — which meant any 64-character string granted admin access.
 *
 * Everything here uses Web Crypto (not node:crypto) so the same code runs in
 * Edge middleware and in Node route handlers.
 */

export const ADMIN_SESSION_COOKIE = 'admin-session';

/** Sessions last a day; re-login is cheap for a single-admin site. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// No explicit return annotation: allocating the buffer keeps the inferred type
// backed by a plain ArrayBuffer, which is what crypto.subtle expects.
function base64UrlDecode(value: string) {
  const padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Signing secret. Throws rather than falling back to a default — an
 * unconfigured deployment must fail to issue sessions, not issue forgeable ones.
 */
function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error(
      'ADMIN_SESSION_SECRET (or NEXTAUTH_SECRET) must be set to a value of at least 16 characters ' +
        'to sign admin sessions.'
    );
  }

  return secret;
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Issue a signed session token. Throws if no signing secret is configured. */
export async function createSessionToken(subject = 'admin'): Promise<string> {
  const now = Date.now();
  const payload: SessionPayload = { sub: subject, iat: now, exp: now + SESSION_TTL_MS };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));

  const key = await getSigningKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload));

  return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Verify a session cookie. Returns the payload only for a token this server
 * signed that has not expired; returns null for anything else — including a
 * missing secret, so verification fails closed.
 *
 * crypto.subtle.verify compares the signature in constant time.
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSignature] = parts;

  try {
    const key = await getSigningKey();
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(encodedSignature),
      encoder.encode(encodedPayload)
    );

    if (!isValid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload))
    ) as SessionPayload;

    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;

    return payload;
  } catch {
    // Malformed base64, malformed JSON, or an unconfigured secret.
    return null;
  }
}

/** Cookie options shared by login and logout so they always agree. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: SESSION_TTL_MS / 1000,
  path: '/',
};
