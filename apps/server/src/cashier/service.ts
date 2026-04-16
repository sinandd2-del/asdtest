import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { getChainAdapter } from '../chain-adapters/registry.js';
import type { ChainNetwork } from '../chain-adapters/types.js';
import { appendLedgerEntry } from '../ledger/service.js';
import { prisma } from '../shared/prisma.js';
import { env } from '../shared/env.js';
import { evaluateWithdrawalRisk } from '../risk/service.js';
import { requestSigning } from '../signing/service.js';

function decimal(v: number) {
  return new Prisma.Decimal(v);
}

export async function ensurePlayerWallet(userId: string, currency: string) {
  const existing = await prisma.wallet.findFirst({
    where: { userId, currency, layer: 'PLAYER', type: 'PLAYER' }
  });

  if (existing) return existing;

  return prisma.wallet.create({
    data: {
      userId,
      type: 'PLAYER',
      layer: 'PLAYER',
      currency,
      flags: {}
    }
  });
}

export async function createDepositAddress(input: {
  userId: string;
  asset: string;
  network: ChainNetwork;
}) {
  const wallet = await ensurePlayerWallet(input.userId, input.asset);
  const adapter = getChainAdapter(input.network);
  const generated = await adapter.generateAddress({ userId: input.userId, asset: input.asset });

  return prisma.depositAddress.create({
    data: {
      userId: input.userId,
      walletId: wallet.id,
      asset: input.asset,
      network: input.network,
      address: generated.address,
      explorerBaseUrl: adapter.explorerTxUrl(''),
      metadata: { qrPayload: generated.qrPayload }
    }
  });
}

export async function ingestDepositEvents(network: ChainNetwork, address: string) {
  const adapter = getChainAdapter(network);
  const events = await adapter.detectDeposits(address);

  for (const event of events) {
    await processDepositEvent({ network, event });
  }
}

export async function processDepositEvent(input: {
  network: ChainNetwork;
  event: {
    externalEventId: string;
    txHash: string;
    toAddress: string;
    amount: number;
    confirmations: number;
    blockNumber?: number;
    rawPayload: Record<string, unknown>;
  };
}) {
  const address = await prisma.depositAddress.findUnique({
    where: { network_address: { network: input.network, address: input.event.toAddress } }
  });

  if (!address) {
    return;
  }

  const required = env.CASHIER_DEFAULT_CONFIRMATIONS;

  const deposit = await prisma.deposit.upsert({
    where: {
      network_txHash_depositAddressId: {
        network: input.network,
        txHash: input.event.txHash,
        depositAddressId: address.id
      }
    },
    create: {
      userId: address.userId,
      walletId: address.walletId,
      depositAddressId: address.id,
      asset: address.asset,
      network: input.network,
      amount: decimal(input.event.amount),
      txHash: input.event.txHash,
      confirmations: input.event.confirmations,
      requiredConfirms: required,
      status: input.event.confirmations >= required ? 'CONFIRMED' : 'CONFIRMING'
    },
    update: {
      confirmations: input.event.confirmations,
      status: input.event.confirmations >= required ? 'CONFIRMED' : 'CONFIRMING'
    }
  });

  await prisma.depositEvent.upsert({
    where: { depositId_externalEventId: { depositId: deposit.id, externalEventId: input.event.externalEventId } },
    create: {
      depositId: deposit.id,
      externalEventId: input.event.externalEventId,
      blockNumber: input.event.blockNumber,
      confirmations: input.event.confirmations,
      rawPayload: input.event.rawPayload
    },
    update: {
      confirmations: input.event.confirmations,
      blockNumber: input.event.blockNumber,
      rawPayload: input.event.rawPayload
    }
  });

  if (deposit.status !== 'CREDITED' && input.event.confirmations >= required) {
    await appendLedgerEntry({
      walletId: deposit.walletId,
      userId: deposit.userId,
      txType: 'DEPOSIT',
      amount: Number(deposit.amount),
      deltaAvailable: Number(deposit.amount),
      deltaHeld: 0,
      deltaPending: 0,
      idempotencyKey: `deposit:${deposit.id}`,
      blockchainTxHash: deposit.txHash,
      blockchainNetwork: deposit.network,
      reference: `deposit:${deposit.txHash}`,
      metadata: { depositId: deposit.id }
    });

    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { status: 'CREDITED', creditedAt: new Date() }
    });
  }
}

export async function createWithdrawal(input: {
  userId: string;
  asset: string;
  network: ChainNetwork;
  amount: number;
  toAddress: string;
  idempotencyKey: string;
  ipAddress: string;
}) {
  const wallet = await ensurePlayerWallet(input.userId, input.asset);
  const adapter = getChainAdapter(input.network);
  const fee = await adapter.estimateFee({ toAddress: input.toAddress, amount: input.amount });

  const allowAddress = await prisma.withdrawalAddress.findUnique({
    where: { userId_network_address: { userId: input.userId, network: input.network, address: input.toAddress } }
  });
  if (!allowAddress?.whitelisted) {
    throw new Error('Address not whitelisted');
  }

  const risk = await evaluateWithdrawalRisk({
    userId: input.userId,
    ipAddress: input.ipAddress,
    amount: input.amount,
    network: input.network
  });

  const snapshot = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
  if (snapshot.availableBalance.lessThan(new Prisma.Decimal(input.amount + fee))) {
    throw new Error('Insufficient available balance');
  }

  const holdEntry = await appendLedgerEntry({
    walletId: wallet.id,
    userId: input.userId,
    txType: 'HOLD',
    amount: input.amount + fee,
    deltaAvailable: -(input.amount + fee),
    deltaHeld: input.amount + fee,
    deltaPending: 0,
    idempotencyKey: `withdraw-hold:${input.idempotencyKey}`,
    reference: `withdrawal-hold:${input.idempotencyKey}`,
    metadata: { network: input.network, address: input.toAddress }
  });

  return prisma.withdrawal.create({
    data: {
      userId: input.userId,
      walletId: wallet.id,
      asset: input.asset,
      network: input.network,
      toAddress: input.toAddress,
      amount: decimal(input.amount),
      estimatedFee: decimal(fee),
      status: risk.score >= 60 ? 'PENDING_APPROVAL' : 'APPROVED',
      holdLedgerEntryId: holdEntry.id,
      cooldownEndsAt: new Date(Date.now() + env.WITHDRAWAL_COOLDOWN_MINUTES * 60_000),
      riskScore: risk.score,
      riskFlags: { flags: risk.flags },
      idempotencyKey: input.idempotencyKey
    }
  });
}

export async function approveWithdrawal(withdrawalId: string, actorId: string) {
  const withdrawal = await prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
  if (!['APPROVED', 'PENDING_APPROVAL'].includes(withdrawal.status)) {
    throw new Error('Withdrawal not approvable');
  }
  if (withdrawal.cooldownEndsAt > new Date()) {
    throw new Error('Withdrawal cooldown active');
  }

  const adapter = getChainAdapter(withdrawal.network as ChainNetwork);
  const unsignedPayload = await adapter.buildUnsignedWithdrawal({
    toAddress: withdrawal.toAddress,
    amount: Number(withdrawal.amount)
  });

  const signing = await prisma.signingRequest.create({
    data: {
      withdrawalId,
      signingProvider: 'isolated-http-signer',
      requestPayload: unsignedPayload,
      status: 'PENDING'
    }
  });

  const signResult = await requestSigning({
    network: withdrawal.network,
    withdrawalId,
    unsignedPayload
  });

  const broadcast = await adapter.broadcastSignedTransaction({ signedPayload: signResult.signedPayload });

  await prisma.signingRequest.update({
    where: { id: signing.id },
    data: {
      status: 'SIGNED',
      signedPayload: signResult.signedPayload,
      signedAt: new Date()
    }
  });

  await prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: {
      status: 'BROADCASTED',
      blockchainTxHash: broadcast.txHash
    }
  });

  await appendLedgerEntry({
    walletId: withdrawal.walletId,
    userId: withdrawal.userId,
    txType: 'WITHDRAWAL',
    amount: Number(withdrawal.amount) + Number(withdrawal.estimatedFee),
    deltaAvailable: 0,
    deltaHeld: -(Number(withdrawal.amount) + Number(withdrawal.estimatedFee)),
    deltaPending: 0,
    idempotencyKey: `withdrawal-complete:${withdrawal.id}`,
    blockchainTxHash: broadcast.txHash,
    blockchainNetwork: withdrawal.network,
    reference: `withdrawal:${withdrawal.id}`,
    metadata: { signerRef: signResult.signerRef, actorId }
  });
}

export async function failWithdrawal(withdrawalId: string, reason: string) {
  const withdrawal = await prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
  await prisma.withdrawal.update({ where: { id: withdrawalId }, data: { status: 'FAILED' } });

  await appendLedgerEntry({
    walletId: withdrawal.walletId,
    userId: withdrawal.userId,
    txType: 'RELEASE',
    amount: Number(withdrawal.amount) + Number(withdrawal.estimatedFee),
    deltaAvailable: Number(withdrawal.amount) + Number(withdrawal.estimatedFee),
    deltaHeld: -(Number(withdrawal.amount) + Number(withdrawal.estimatedFee)),
    deltaPending: 0,
    idempotencyKey: `withdrawal-release:${withdrawal.id}`,
    reference: `withdrawal-release:${withdrawal.id}`,
    metadata: { reason }
  });
}

export async function syncWithdrawalConfirmations(withdrawalId: string) {
  const withdrawal = await prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
  if (!withdrawal.blockchainTxHash) return;

  const adapter = getChainAdapter(withdrawal.network as ChainNetwork);
  const txInfo = await adapter.lookupTransaction(withdrawal.blockchainTxHash);
  if (txInfo.exists && txInfo.confirmations >= env.CASHIER_DEFAULT_CONFIRMATIONS) {
    await prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
  }
}

export async function getTreasuryOverview(currency: string) {
  const [cold, standby, hot, policy] = await Promise.all([
    prisma.wallet.findFirst({ where: { type: 'INTERNAL', layer: 'COLD_TREASURY', currency } }),
    prisma.wallet.findFirst({ where: { type: 'INTERNAL', layer: 'STANDBY_REFILL', currency } }),
    prisma.wallet.findFirst({ where: { type: 'INTERNAL', layer: 'HOT_PAYOUT', currency } }),
    prisma.internalWalletPolicy.findUnique({ where: { currency } })
  ]);

  return { cold, standby, hot, policy };
}

export async function ensureTreasuryWallets(currency: string) {
  const layers: Array<'COLD_TREASURY' | 'STANDBY_REFILL' | 'HOT_PAYOUT'> = ['COLD_TREASURY', 'STANDBY_REFILL', 'HOT_PAYOUT'];
  for (const layer of layers) {
    await prisma.wallet.upsert({
      where: { type_layer_currency: { type: 'INTERNAL', layer, currency } },
      create: {
        userId: null,
        type: 'INTERNAL',
        layer,
        currency,
        flags: {}
      },
      update: {}
    });
  }

  await prisma.internalWalletPolicy.upsert({
    where: { currency },
    create: {
      currency,
      hotMaxBalance: decimal(50_000),
      hotMinBalance: decimal(5_000),
      standbyMinBalance: decimal(25_000)
    },
    update: {}
  });
}

export async function addWithdrawalAddress(input: {
  userId: string;
  asset: string;
  network: ChainNetwork;
  address: string;
  nickname?: string;
}) {
  return prisma.withdrawalAddress.upsert({
    where: { userId_network_address: { userId: input.userId, network: input.network, address: input.address } },
    create: {
      userId: input.userId,
      asset: input.asset,
      network: input.network,
      address: input.address,
      nickname: input.nickname,
      whitelisted: true
    },
    update: { nickname: input.nickname, whitelisted: true }
  });
}

export async function createUserWalletsForDefaultAssets(userId: string) {
  const assets = ['BTC', 'USDT'];
  for (const asset of assets) {
    await ensurePlayerWallet(userId, asset);
  }
}

export async function flagSuspiciousSession(userId: string, sessionId: string, reason: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { suspicious: true } });
  await prisma.riskFlag.create({
    data: {
      userId,
      type: 'session',
      severity: 'medium',
      context: { sessionId, reason }
    }
  });
}
