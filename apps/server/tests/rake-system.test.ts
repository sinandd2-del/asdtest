import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HoldemTableState } from '../src/holdem/types.js';

const db = {
  rules: [] as any[],
  audits: [] as any[]
};

vi.mock('../src/shared/prisma.js', () => {
  const prisma = {
    rakeRuleConfig: {
      aggregate: async () => ({ _max: { updatedAt: db.rules.length ? new Date(db.rules[0].updatedAt) : null, version: db.rules.length ? Math.max(...db.rules.map((r) => r.version)) : null } }),
      findMany: async (args: any = {}) => {
        let rows = [...db.rules];
        const w = args.where ?? {};
        if (w.active !== undefined) rows = rows.filter((r) => r.active === w.active);
        if (w.gameType) rows = rows.filter((r) => r.gameType === w.gameType);
        if (w.currency) rows = rows.filter((r) => r.currency === w.currency);
        if (w.headsUpOnly !== undefined) rows = rows.filter((r) => r.headsUpOnly === w.headsUpOnly);
        if (w.effectiveFrom) rows = rows.filter((r) => r.effectiveFrom.getTime() === w.effectiveFrom.getTime());
        if (w.id?.not) rows = rows.filter((r) => r.id !== w.id.not);
        if (w.stakeMin?.lte !== undefined) rows = rows.filter((r) => Number(r.stakeMin) <= Number(w.stakeMin.lte));
        if (w.stakeMax?.gte !== undefined) rows = rows.filter((r) => Number(r.stakeMax) >= Number(w.stakeMax.gte));
        if (w.blindMin?.lte !== undefined) rows = rows.filter((r) => Number(r.blindMin) <= Number(w.blindMin.lte));
        if (w.blindMax?.gte !== undefined) rows = rows.filter((r) => Number(r.blindMax) >= Number(w.blindMax.gte));
        if (w.minTableSize?.lte !== undefined) rows = rows.filter((r) => r.minTableSize <= w.minTableSize.lte);
        if (w.maxTableSize?.gte !== undefined) rows = rows.filter((r) => r.maxTableSize >= w.maxTableSize.gte);
        if (w.effectiveFrom?.lte) rows = rows.filter((r) => r.effectiveFrom <= w.effectiveFrom.lte);
        return rows.sort((a, b) => b.version - a.version).slice(0, args.take ?? rows.length);
      },
      create: async ({ data }: any) => {
        const row = { ...data, id: `r${db.rules.length + 1}`, createdAt: new Date(), updatedAt: new Date() };
        db.rules.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const idx = db.rules.findIndex((r) => r.id === where.id);
        db.rules[idx] = { ...db.rules[idx], ...data, updatedAt: new Date() };
        return db.rules[idx];
      },
      findUnique: async ({ where }: any) => db.rules.find((r) => r.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where }: any) => db.rules.find((r) => r.id === where.id) ?? (() => { throw new Error('not found'); })()
    },
    auditLog: {
      create: async ({ data }: any) => {
        const row = { ...data, id: `a${db.audits.length + 1}`, createdAt: new Date() };
        db.audits.push(row);
        return row;
      },
      findMany: async () => [...db.audits],
      findFirst: async () => null
    },
    $transaction: async (fn: any) => fn(prisma)
  };
  return { prisma };
});

const rakeMod = await import('../src/holdem/rake-config.js');
const settlementMod = await import('../src/holdem/settlement.js');

function mockState(overrides: Partial<HoldemTableState> = {}): HoldemTableState {
  return {
    tableId: 't1',
    handId: 'h1',
    version: 5,
    phase: 'hand_complete',
    smallBlind: 1,
    bigBlind: 2,
    minRaise: 2,
    currentBet: 2,
    pot: 100,
    sidePots: [],
    board: ['Ac', 'Kd', '7h'],
    burn: [],
    seats: [
      { userId: 'u1', seatNumber: 1, stack: 0, inHand: true, folded: false, allIn: true, sitOut: false, betStreet: 0, committed: 50, holeCards: ['As', 'Ad'], connected: true },
      { userId: 'u2', seatNumber: 2, stack: 0, inHand: true, folded: false, allIn: true, sitOut: false, betStreet: 0, committed: 50, holeCards: ['Ks', 'Kh'], connected: true }
    ],
    deckRef: 'ref',
    actionNonce: new Set<string>(),
    lastActionAt: Date.now(),
    startedAt: Date.now(),
    showdown: { winners: [{ userId: 'u1', amount: 100, rank: 1 }], reveal: { u1: ['As', 'Ad'], u2: ['Ks', 'Kh'] } },
    ...overrides
  } as HoldemTableState;
}

describe('rake system (db-backed behavior)', () => {
  beforeEach(() => {
    db.rules.length = 0;
    db.audits.length = 0;
  });

  it('DB-backed rule creation/edit and no-flop-no-drop', async () => {
    const rule = await rakeMod.createRakeRule({
      gameType: 'NLHE',
      stakeMin: 0.01,
      stakeMax: 1,
      blindMin: 1,
      blindMax: 5,
      headsUpOnly: false,
      minTableSize: 2,
      maxTableSize: 9,
      noFlopNoDrop: true,
      rakeBps: 500,
      maxCap: 2,
      currency: 'USDT',
      vipDiscountBps: 0,
      effectiveFrom: new Date(Date.now() - 1000).toISOString(),
      active: true,
      createdByUserId: 'admin-1'
    });
    expect(rule.version).toBe(1);
    const out = rakeMod.calculateRake({ totalPot: 100, sawFlop: false, isHeadsUp: false, rule });
    expect(out.rake).toBe(0);
  });

  it('enforces overlap conflict', async () => {
    await rakeMod.createRakeRule({ gameType: 'NLHE', stakeMin: 0.1, stakeMax: 1, blindMin: 1, blindMax: 10, headsUpOnly: false, minTableSize: 2, maxTableSize: 9, noFlopNoDrop: true, rakeBps: 500, maxCap: 2, currency: 'USDT', vipDiscountBps: 0, effectiveFrom: new Date().toISOString(), active: true, createdByUserId: 'admin' });
    await expect(rakeMod.createRakeRule({ gameType: 'NLHE', stakeMin: 0.5, stakeMax: 1.5, blindMin: 1, blindMax: 10, headsUpOnly: false, minTableSize: 2, maxTableSize: 9, noFlopNoDrop: true, rakeBps: 400, maxCap: 2, currency: 'USDT', vipDiscountBps: 0, effectiveFrom: new Date().toISOString(), active: true, createdByUserId: 'admin' })).rejects.toThrow('rake_conflict_violation');
  });

  it('scheduled activation lookup + historical replay idempotency', async () => {
    await rakeMod.createRakeRule({ gameType: 'NLHE', stakeMin: 0.1, stakeMax: 1, blindMin: 1, blindMax: 10, headsUpOnly: false, minTableSize: 2, maxTableSize: 9, noFlopNoDrop: false, rakeBps: 400, maxCap: 2, currency: 'USDT', vipDiscountBps: 0, effectiveFrom: new Date(Date.now() - 1000).toISOString(), active: true, createdByUserId: 'admin' });
    await rakeMod.createRakeRule({ gameType: 'NLHE', stakeMin: 0.1, stakeMax: 1, blindMin: 1, blindMax: 10, headsUpOnly: true, minTableSize: 2, maxTableSize: 2, noFlopNoDrop: false, rakeBps: 300, maxCap: 1, currency: 'USDT', vipDiscountBps: 0, effectiveFrom: new Date(Date.now() + 1000).toISOString(), active: true, createdByUserId: 'admin' });

    const now = await rakeMod.resolveActiveRakeRule({ gameType: 'NLHE', smallBlind: 0.1, bigBlind: 2, tableSize: 2, isHeadsUp: true, currency: 'USDT', at: new Date() });
    const later = await rakeMod.resolveActiveRakeRule({ gameType: 'NLHE', smallBlind: 0.1, bigBlind: 2, tableSize: 2, isHeadsUp: true, currency: 'USDT', at: new Date(Date.now() + 2000) });
    expect(now?.version).not.toBe(later?.version);

    const plan1 = await settlementMod.buildSettlementPlan({ tableState: mockState(), gameType: 'NLHE', currency: 'USDT' });
    const plan2 = await settlementMod.buildSettlementPlan({ tableState: mockState(), gameType: 'NLHE', currency: 'USDT' });
    expect(plan1?.rakeIdempotencyKey).toBe(plan2?.rakeIdempotencyKey);
  });
});
