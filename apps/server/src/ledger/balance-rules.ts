export type BalanceState = {
  available: number;
  held: number;
  pending: number;
};

export function applyDelta(state: BalanceState, delta: BalanceState): BalanceState {
  const next = {
    available: state.available + delta.available,
    held: state.held + delta.held,
    pending: state.pending + delta.pending
  };

  if (next.available < 0 || next.held < 0 || next.pending < 0) {
    throw new Error('negative_balance');
  }

  return next;
}

export function holdForWithdrawal(state: BalanceState, amountWithFee: number): BalanceState {
  if (state.available < amountWithFee) {
    throw new Error('insufficient_available');
  }

  return applyDelta(state, { available: -amountWithFee, held: amountWithFee, pending: 0 });
}

export function releaseFailedWithdrawalHold(state: BalanceState, amountWithFee: number): BalanceState {
  if (state.held < amountWithFee) {
    throw new Error('insufficient_held');
  }

  return applyDelta(state, { available: amountWithFee, held: -amountWithFee, pending: 0 });
}

export function finalizeWithdrawal(state: BalanceState, amountWithFee: number): BalanceState {
  if (state.held < amountWithFee) {
    throw new Error('insufficient_held');
  }

  return applyDelta(state, { available: 0, held: -amountWithFee, pending: 0 });
}

export function idempotentOnce(key: string, seen: Set<string>): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
