import { createHash, timingSafeEqual } from 'crypto';

/**
 * Compare two secrets without leaking their contents through timing.
 *
 * Hashing first gives both sides a fixed length (timingSafeEqual throws on
 * mismatched lengths, which would itself leak the length of the real secret).
 *
 * Uses node:crypto, so this is for route handlers only — middleware runs on the
 * Edge runtime and must use the Web Crypto helpers in ./session instead.
 */
export function safeEqual(a: string, b: string): boolean {
  const hashedA = createHash('sha256').update(a).digest();
  const hashedB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashedA, hashedB);
}
