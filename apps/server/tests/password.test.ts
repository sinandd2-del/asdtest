import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/security/password.js';

describe('password security helpers', () => {
  it('hashes and verifies password with argon2id', async () => {
    const password = 'StrongPass123!@#';
    const hash = await hashPassword(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, 'WrongPass123!@#')).resolves.toBe(false);
  });
});
