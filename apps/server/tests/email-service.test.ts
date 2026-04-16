import { describe, expect, it } from 'vitest';
import { emailLinks } from '../src/notifications/email-service.js';
import { hashToken } from '../src/security/token-hash.js';

describe('email link/token helpers', () => {
  it('builds verify/reset links with encoded token', () => {
    const links = emailLinks('abc123');
    expect(links.verify).toContain('/account/verify-email?token=abc123');
    expect(links.reset).toContain('/account/reset-password?token=abc123');
  });

  it('hashes tokens deterministically for one-time storage checks', () => {
    expect(hashToken('token-a')).toBe(hashToken('token-a'));
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});
