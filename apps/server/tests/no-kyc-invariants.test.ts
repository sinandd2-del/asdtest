import { describe, expect, it } from 'vitest';
import { registerSchema } from '@poker/contracts';

describe('no-KYC anonymous flow invariants', () => {
  it('accepts registration without identity fields', () => {
    const parsed = registerSchema.safeParse({ username: 'player_one', password: 'StrongPass123!@#' });
    expect(parsed.success).toBe(true);
  });
});
