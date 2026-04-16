import { createHash, timingSafeEqual } from 'node:crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatches(token: string, hashedToken: string): boolean {
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(hashedToken);
  return a.length === b.length && timingSafeEqual(a, b);
}
