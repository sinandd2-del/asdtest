import { appendLedgerEntry } from '../ledger/service.js';
import { prisma } from '../shared/prisma.js';
import { calculateRake, resolveActiveRakeRule } from './rake-config.js';
import type { HoldemTableState } from './types.js';

export async function buildSettlementPlan(input: {
  tableState: HoldemTableState;
  gameType?: 'NLHE' | 'PLO' | 'MIXED';
  currency?: string;
  rakeBps?: number;
}) {
  if (!input.tableState.showdown) return null;

  const totalPot = input.tableState.pot;
  const headsUp = input.tableState.seats.filter((s) => s.inHand).length === 2;
  const activeRule = await resolveActiveRakeRule({
    gameType: input.gameType ?? 'NLHE',
    smallBlind: input.tableState.smallBlind,
    bigBlind: input.tableState.bigBlind,
    tableSize: input.tableState.seats.length,
    isHeadsUp: headsUp,
    currency: input.currency ?? 'USDT'
  });

  const resolved = calculateRake({
    totalPot,
    sawFlop: input.tableState.board.length >= 3,
    isHeadsUp: headsUp,
    vipDiscountBps: activeRule?.vipDiscountBps,
    rule: activeRule
  });

  const legacyRake = input.rakeBps ? Math.floor((totalPot * input.rakeBps) / 10_000) : 0;
  const rake = Math.max(resolved.rake, legacyRake);
  const handRef = `hand:${input.tableState.handId}`;

  return {
    handRef,
    rake,
    reason: resolved.reason,
    ruleVersion: resolved.appliedRuleVersion,
    noFlopNoDrop: activeRule?.noFlopNoDrop ?? false,
    currency: input.currency ?? 'USDT',
    payouts: input.tableState.showdown.winners.map((winner) => ({
      userId: winner.userId,
      amount: Math.max(0, winner.amount - rake / input.tableState.showdown!.winners.length),
      idempotencyKey: `${handRef}:payout:${winner.userId}`
    })),
    rakeIdempotencyKey: `${handRef}:rake`
  };
}

export async function settleHandLedger(input: { tableState: HoldemTableState; rakeBps?: number; gameType?: 'NLHE' | 'PLO' | 'MIXED'; currency?: string }) {
  if (!input.tableState.showdown) return;

  const seen = await prisma.auditLog.findFirst({ where: { action: 'holdem.settlement', metadata: { path: ['handId'], equals: input.tableState.handId } } });
  if (seen) return;

  const plan = await buildSettlementPlan(input);
  if (!plan) return;

  for (const payoutPlan of plan.payouts) {
    const wallet = await prisma.wallet.findFirst({ where: { userId: payoutPlan.userId, layer: 'PLAYER', type: 'PLAYER', currency: plan.currency } });
    if (!wallet) continue;

    await appendLedgerEntry({
      walletId: wallet.id,
      userId: payoutPlan.userId,
      txType: 'POKER_PAYOUT',
      amount: payoutPlan.amount,
      deltaAvailable: payoutPlan.amount,
      deltaHeld: 0,
      deltaPending: 0,
      idempotencyKey: payoutPlan.idempotencyKey,
      reference: plan.handRef,
      metadata: { handId: input.tableState.handId, rakeRuleVersion: plan.ruleVersion }
    });
  }

  if (plan.rake > 0) {
    const hot = await prisma.wallet.findFirst({ where: { type: 'INTERNAL', layer: 'HOT_PAYOUT', currency: plan.currency } });
    if (hot) {
      await appendLedgerEntry({
        walletId: hot.id,
        txType: 'RAKE',
        amount: plan.rake,
        deltaAvailable: plan.rake,
        deltaHeld: 0,
        deltaPending: 0,
        idempotencyKey: plan.rakeIdempotencyKey,
        reference: plan.handRef,
        metadata: {
          handId: input.tableState.handId,
          rakeRuleVersion: plan.ruleVersion,
          rakeReason: plan.reason,
          noFlopNoDrop: plan.noFlopNoDrop
        }
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actor: 'system',
      action: 'holdem.settlement',
      ipAddress: '127.0.0.1',
      metadata: {
        handId: input.tableState.handId,
        pot: input.tableState.pot,
        rake: plan.rake,
        rakeRuleVersion: plan.ruleVersion,
        rakeReason: plan.reason
      }
    }
  });
}
