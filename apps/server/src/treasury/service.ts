import { prisma } from '../shared/prisma.js';
import { appendLedgerEntry } from '../ledger/service.js';

export async function applyTreasuryRefill(input: {
  currency: string;
  amount: number;
  idempotencyKey: string;
  reference: string;
}) {
  const standby = await prisma.wallet.findFirst({
    where: { type: 'INTERNAL', layer: 'STANDBY_REFILL', currency: input.currency }
  });
  const hot = await prisma.wallet.findFirst({
    where: { type: 'INTERNAL', layer: 'HOT_PAYOUT', currency: input.currency }
  });

  if (!standby || !hot) throw new Error('Treasury wallets not configured');

  await appendLedgerEntry({
    walletId: standby.id,
    txType: 'TREASURY_SWEEP',
    amount: input.amount,
    deltaAvailable: -input.amount,
    deltaHeld: 0,
    deltaPending: 0,
    idempotencyKey: `${input.idempotencyKey}:standby`,
    reference: input.reference,
    metadata: { from: 'standby', to: 'hot' }
  });

  await appendLedgerEntry({
    walletId: hot.id,
    txType: 'TREASURY_REFILL',
    amount: input.amount,
    deltaAvailable: input.amount,
    deltaHeld: 0,
    deltaPending: 0,
    idempotencyKey: `${input.idempotencyKey}:hot`,
    reference: input.reference,
    metadata: { from: 'standby', to: 'hot' }
  });
}
