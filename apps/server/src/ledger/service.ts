import { Prisma, type LedgerTxType, type Wallet } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../shared/prisma.js';
import { realtimeBus } from '../shared/realtime-bus.js';

function decimal(v: number) {
  return new Prisma.Decimal(v);
}

export async function appendLedgerEntry(input: {
  walletId: string;
  userId?: string;
  txType: LedgerTxType;
  amount: number;
  deltaAvailable: number;
  deltaHeld: number;
  deltaPending: number;
  idempotencyKey: string;
  immutableRef?: string;
  blockchainTxHash?: string;
  blockchainNetwork?: string;
  reference: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: input.walletId } });
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const existing = await tx.ledgerEntry.findUnique({
      where: { walletId_idempotencyKey: { walletId: input.walletId, idempotencyKey: input.idempotencyKey } }
    });
    if (existing) {
      return existing;
    }

    const nextAvailable = wallet.availableBalance.add(decimal(input.deltaAvailable));
    const nextHeld = wallet.heldBalance.add(decimal(input.deltaHeld));
    const nextPending = wallet.pendingBalance.add(decimal(input.deltaPending));

    if (nextAvailable.lessThan(0) || nextHeld.lessThan(0) || nextPending.lessThan(0)) {
      throw new Error('Insufficient balance mutation');
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: nextAvailable,
        heldBalance: nextHeld,
        pendingBalance: nextPending
      }
    });

    const entry = await tx.ledgerEntry.create({
      data: {
        walletId: input.walletId,
        userId: input.userId,
        txType: input.txType,
        amount: decimal(input.amount),
        deltaAvailable: decimal(input.deltaAvailable),
        deltaHeld: decimal(input.deltaHeld),
        deltaPending: decimal(input.deltaPending),
        idempotencyKey: input.idempotencyKey,
        immutableRef: input.immutableRef ?? randomUUID(),
        blockchainTxHash: input.blockchainTxHash,
        blockchainNetwork: input.blockchainNetwork,
        reference: input.reference,
        metadata: input.metadata ?? {}
      }
    });

    realtimeBus.emit('wallet:delta', {
      userId: input.userId,
      walletId: input.walletId,
      deltaAvailable: input.deltaAvailable,
      deltaHeld: input.deltaHeld,
      deltaPending: input.deltaPending,
      reason: input.txType,
      reference: input.reference
    });

    return entry;
  });
}

export function walletSnapshot(wallet: Wallet) {
  return {
    available: Number(wallet.availableBalance),
    held: Number(wallet.heldBalance),
    pending: Number(wallet.pendingBalance),
    total: Number(wallet.availableBalance.add(wallet.heldBalance).add(wallet.pendingBalance))
  };
}
