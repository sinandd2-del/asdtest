import { describe, expect, it } from 'vitest';
import { canApproveWithdrawal } from '../src/cashier/workflow.js';

describe('withdrawal approval flow', () => {
  it('blocks approvals before cooldown', () => {
    const result = canApproveWithdrawal({ status: 'APPROVED', cooldownEndsAt: new Date(Date.now() + 5_000) });
    expect(result).toBe(false);
  });

  it('allows approval after cooldown in approvable state', () => {
    const result = canApproveWithdrawal({ status: 'PENDING_APPROVAL', cooldownEndsAt: new Date(Date.now() - 5_000) });
    expect(result).toBe(true);
  });
});
