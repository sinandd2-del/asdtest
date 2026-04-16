import { describe, expect, it } from 'vitest';
import { hashToken, tokenMatches } from '../src/security/token-hash.js';

describe('token hash helpers', () => {
  it('matches a valid token/hash pair', () => {
    const token = 'sample-refresh-token';
    const hash = hashToken(token);
    expect(tokenMatches(token, hash)).toBe(true);
  });

  it('rejects different tokens', () => {
    const token = 'sample-refresh-token';
    const hash = hashToken(token);
    expect(tokenMatches('different-token', hash)).toBe(false);
  });
});
