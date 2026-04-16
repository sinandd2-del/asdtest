import type { ChainAdapter } from './types.js';

export async function runAdapterContract(adapter: ChainAdapter) {
  const address = await adapter.generateAddress({ userId: 'u1', asset: 'USDT' });
  if (!address.address) throw new Error('missing_address');

  const fee = await adapter.estimateFee({ toAddress: address.address, amount: 1 });
  if (fee < 0) throw new Error('invalid_fee');

  const unsigned = await adapter.buildUnsignedWithdrawal({ toAddress: address.address, amount: 1 });
  if (!unsigned) throw new Error('missing_unsigned');

  return true;
}
