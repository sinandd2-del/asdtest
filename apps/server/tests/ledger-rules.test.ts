import { describe, expect, it } from 'vitest';
import { applyDelta, finalizeWithdrawal, holdForWithdrawal, idempotentOnce, releaseFailedWithdrawalHold } from '../src/ledger/balance-rules.js';

describe('ledger append rules', () => {
  it('applies deltas without going negative', () => {
    const next = applyDelta({ available: 10, held: 1, pending: 0 }, { available: -2, held: 2, pending: 0 });
    expect(next).toEqual({ available: 8, held: 3, pending: 0 });
  });

  it('protects against duplicate event keys', () => {
    const seen = new Set<string>();
    expect(idempotentOnce('dep-1', seen)).toBe(true);
    expect(idempotentOnce('dep-1', seen)).toBe(false);
  });

  it('holds and releases payout funds', () => {
    const held = holdForWithdrawal({ available: 100, held: 0, pending: 0 }, 20);
    expect(held).toEqual({ available: 80, held: 20, pending: 0 });

    const released = releaseFailedWithdrawalHold(held, 20);
    expect(released).toEqual({ available: 100, held: 0, pending: 0 });
  });

  it('finalizes held payout', () => {
    const finalized = finalizeWithdrawal({ available: 80, held: 20, pending: 0 }, 20);
    expect(finalized).toEqual({ available: 80, held: 0, pending: 0 });
  });
});
