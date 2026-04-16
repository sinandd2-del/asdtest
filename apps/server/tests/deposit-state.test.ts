import { describe, expect, it } from 'vitest';
import { nextDepositState } from '../src/cashier/deposit-state.js';

describe('deposit confirmation crediting', () => {
  it('moves to confirming below threshold', () => {
    expect(nextDepositState(1, 3, false)).toBe('confirming');
  });

  it('moves to confirmed at threshold', () => {
    expect(nextDepositState(3, 3, false)).toBe('confirmed');
  });

  it('keeps credited immutable', () => {
    expect(nextDepositState(99, 3, true)).toBe('credited');
  });
});
