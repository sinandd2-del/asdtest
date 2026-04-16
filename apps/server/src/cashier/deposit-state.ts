export type DepositLifecycle = 'created' | 'pending_chain' | 'seen' | 'confirming' | 'confirmed' | 'credited';

export function nextDepositState(confirmations: number, threshold: number, alreadyCredited: boolean): DepositLifecycle {
  if (alreadyCredited) return 'credited';
  if (confirmations <= 0) return 'seen';
  if (confirmations < threshold) return 'confirming';
  if (confirmations >= threshold) return 'confirmed';
  return 'pending_chain';
}
