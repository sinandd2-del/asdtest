import { Prisma, type RakeRuleConfig } from '@prisma/client';
import { prisma } from '../shared/prisma.js';

export type RakeRule = {
  id: string;
  version: number;
  gameType: 'NLHE' | 'PLO' | 'MIXED';
  stakeMin: number;
  stakeMax: number;
  blindMin: number;
  blindMax: number;
  headsUpOnly: boolean;
  minTableSize: number;
  maxTableSize: number;
  noFlopNoDrop: boolean;
  rakeBps: number;
  maxCap: number;
  currency: string;
  vipDiscountBps: number;
  effectiveFrom: string;
  active: boolean;
  createdByUserId?: string | null;
  lastChangedByUserId?: string | null;
  lastAuditLogId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RakeResolutionInput = {
  gameType: RakeRule['gameType'];
  smallBlind: number;
  bigBlind: number;
  tableSize: number;
  isHeadsUp: boolean;
  currency: string;
  at?: Date;
};

type CreateRuleInput = Omit<RakeRule, 'id' | 'version' | 'createdAt' | 'updatedAt'>;

let cache: { updatedAt: number; rules: RakeRule[] } | null = null;

function toNum(v: Prisma.Decimal | number): number {
  return typeof v === 'number' ? v : Number(v);
}

function mapRule(row: RakeRuleConfig): RakeRule {
  return {
    id: row.id,
    version: row.version,
    gameType: row.gameType as RakeRule['gameType'],
    stakeMin: toNum(row.stakeMin),
    stakeMax: toNum(row.stakeMax),
    blindMin: toNum(row.blindMin),
    blindMax: toNum(row.blindMax),
    headsUpOnly: row.headsUpOnly,
    minTableSize: row.minTableSize,
    maxTableSize: row.maxTableSize,
    noFlopNoDrop: row.noFlopNoDrop,
    rakeBps: row.rakeBps,
    maxCap: toNum(row.maxCap),
    currency: row.currency,
    vipDiscountBps: row.vipDiscountBps,
    effectiveFrom: row.effectiveFrom.toISOString(),
    active: row.active,
    createdByUserId: row.createdByUserId,
    lastChangedByUserId: row.lastChangedByUserId,
    lastAuditLogId: row.lastAuditLogId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function writeAudit(action: string, metadata: Record<string, unknown>, userId?: string) {
  const log = await prisma.auditLog.create({
    data: {
      userId,
      actor: userId ?? 'system',
      action,
      ipAddress: '127.0.0.1',
      metadata
    }
  });
  return log.id;
}

async function invalidateCache() {
  cache = null;
}

export async function listRakeRules() {
  const latest = await prisma.rakeRuleConfig.aggregate({ _max: { updatedAt: true } });
  const updatedAt = latest._max.updatedAt?.getTime() ?? 0;
  if (cache && cache.updatedAt === updatedAt) {
    return cache.rules;
  }

  const rows = await prisma.rakeRuleConfig.findMany({ orderBy: { version: 'desc' } });
  const rules = rows.map(mapRule);
  cache = { updatedAt, rules };
  return rules;
}

async function detectConflictsTx(
  tx: Prisma.TransactionClient,
  candidate: Omit<CreateRuleInput, 'createdByUserId' | 'lastChangedByUserId' | 'lastAuditLogId'>,
  excludeRuleId?: string
) {
  const overlapping = await tx.rakeRuleConfig.findMany({
    where: {
      id: excludeRuleId ? { not: excludeRuleId } : undefined,
      active: true,
      gameType: candidate.gameType,
      currency: candidate.currency,
      headsUpOnly: candidate.headsUpOnly,
      effectiveFrom: new Date(candidate.effectiveFrom),
      stakeMin: { lte: candidate.stakeMax },
      stakeMax: { gte: candidate.stakeMin },
      blindMin: { lte: candidate.blindMax },
      blindMax: { gte: candidate.blindMin },
      minTableSize: { lte: candidate.maxTableSize },
      maxTableSize: { gte: candidate.minTableSize }
    }
  });
  return overlapping.map(mapRule);
}

export async function detectRakeConflicts(candidate: Omit<CreateRuleInput, 'createdByUserId' | 'lastChangedByUserId' | 'lastAuditLogId'>) {
  return detectConflictsTx(prisma, candidate);
}

export async function createRakeRule(input: Omit<CreateRuleInput, 'lastChangedByUserId' | 'lastAuditLogId'>) {
  const created = await prisma.$transaction(async (tx) => {
    const conflicts = await detectConflictsTx(tx, input);
    if (conflicts.length > 0 && input.active) {
      throw new Error('rake_conflict_violation');
    }

    const maxVersion = await tx.rakeRuleConfig.aggregate({ _max: { version: true } });
    const version = (maxVersion._max.version ?? 0) + 1;

    return tx.rakeRuleConfig.create({
      data: {
        version,
        gameType: input.gameType,
        stakeMin: new Prisma.Decimal(input.stakeMin),
        stakeMax: new Prisma.Decimal(input.stakeMax),
        blindMin: new Prisma.Decimal(input.blindMin),
        blindMax: new Prisma.Decimal(input.blindMax),
        headsUpOnly: input.headsUpOnly,
        minTableSize: input.minTableSize,
        maxTableSize: input.maxTableSize,
        noFlopNoDrop: input.noFlopNoDrop,
        rakeBps: input.rakeBps,
        maxCap: new Prisma.Decimal(input.maxCap),
        currency: input.currency,
        vipDiscountBps: input.vipDiscountBps,
        effectiveFrom: new Date(input.effectiveFrom),
        active: input.active,
        createdByUserId: input.createdByUserId
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const auditId = await writeAudit('rake.rule.create', { ruleId: created.id, version: created.version, effectiveFrom: created.effectiveFrom }, input.createdByUserId ?? undefined);
  await prisma.rakeRuleConfig.update({ where: { id: created.id }, data: { lastAuditLogId: auditId, lastChangedByUserId: input.createdByUserId ?? null } });
  await invalidateCache();
  return mapRule(await prisma.rakeRuleConfig.findUniqueOrThrow({ where: { id: created.id } }));
}

export async function updateRakeRule(ruleId: string, patch: Partial<Omit<CreateRuleInput, 'createdByUserId' | 'lastChangedByUserId' | 'lastAuditLogId'>>) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.rakeRuleConfig.findUnique({ where: { id: ruleId } });
    if (!existing) throw new Error('rake_rule_not_found');
    const merged = {
      ...mapRule(existing),
      ...patch,
      effectiveFrom: patch.effectiveFrom ?? existing.effectiveFrom.toISOString()
    } as CreateRuleInput;

    const conflicts = await detectConflictsTx(tx, merged, ruleId);
    if (conflicts.length > 0 && (patch.active ?? existing.active)) {
      throw new Error('rake_conflict_violation');
    }

    return tx.rakeRuleConfig.update({
      where: { id: ruleId },
      data: {
        gameType: patch.gameType,
        stakeMin: patch.stakeMin !== undefined ? new Prisma.Decimal(patch.stakeMin) : undefined,
        stakeMax: patch.stakeMax !== undefined ? new Prisma.Decimal(patch.stakeMax) : undefined,
        blindMin: patch.blindMin !== undefined ? new Prisma.Decimal(patch.blindMin) : undefined,
        blindMax: patch.blindMax !== undefined ? new Prisma.Decimal(patch.blindMax) : undefined,
        headsUpOnly: patch.headsUpOnly,
        minTableSize: patch.minTableSize,
        maxTableSize: patch.maxTableSize,
        noFlopNoDrop: patch.noFlopNoDrop,
        rakeBps: patch.rakeBps,
        maxCap: patch.maxCap !== undefined ? new Prisma.Decimal(patch.maxCap) : undefined,
        currency: patch.currency,
        vipDiscountBps: patch.vipDiscountBps,
        effectiveFrom: patch.effectiveFrom ? new Date(patch.effectiveFrom) : undefined,
        active: patch.active
      }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const auditId = await writeAudit('rake.rule.update', { ruleId, patchKeys: Object.keys(patch) });
  await prisma.rakeRuleConfig.update({ where: { id: ruleId }, data: { lastAuditLogId: auditId } });
  await invalidateCache();
  return mapRule(await prisma.rakeRuleConfig.findUniqueOrThrow({ where: { id: ruleId } }));
}

export async function setRakeRuleActive(ruleId: string, active: boolean) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.rakeRuleConfig.findUnique({ where: { id: ruleId } });
    if (!existing) throw new Error('rake_rule_not_found');

    if (active) {
      const conflicts = await detectConflictsTx(tx, mapRule(existing), ruleId);
      if (conflicts.length > 0) throw new Error('rake_conflict_violation');
    }

    return tx.rakeRuleConfig.update({ where: { id: ruleId }, data: { active, deactivatedAt: active ? null : new Date() } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const auditId = await writeAudit(active ? 'rake.rule.activate' : 'rake.rule.deactivate', { ruleId, version: updated.version });
  await prisma.rakeRuleConfig.update({ where: { id: ruleId }, data: { lastAuditLogId: auditId } });
  await invalidateCache();
  return mapRule(updated);
}

export async function resolveActiveRakeRule(input: RakeResolutionInput): Promise<RakeRule | null> {
  const at = input.at ?? new Date();
  const rows = await prisma.rakeRuleConfig.findMany({
    where: {
      active: true,
      gameType: input.gameType,
      currency: input.currency,
      OR: [{ headsUpOnly: false }, { headsUpOnly: input.isHeadsUp }],
      minTableSize: { lte: input.tableSize },
      maxTableSize: { gte: input.tableSize },
      blindMin: { lte: input.bigBlind },
      blindMax: { gte: input.bigBlind },
      stakeMin: { lte: input.smallBlind },
      stakeMax: { gte: input.smallBlind },
      effectiveFrom: { lte: at }
    },
    orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    take: 1
  });
  return rows[0] ? mapRule(rows[0]) : null;
}

export function calculateRake(input: {
  totalPot: number;
  sawFlop: boolean;
  isHeadsUp: boolean;
  vipDiscountBps?: number;
  rule: RakeRule | null;
}) {
  if (!input.rule) return { rake: 0, appliedRuleVersion: null, reason: 'no_rule' as const };
  if (input.rule.noFlopNoDrop && !input.sawFlop) {
    return { rake: 0, appliedRuleVersion: input.rule.version, reason: 'no_flop_no_drop' as const };
  }

  const effectiveBps = Math.max(0, input.rule.rakeBps - Math.max(0, input.vipDiscountBps ?? 0));
  const raw = Math.floor((input.totalPot * effectiveBps) / 10_000);
  const rake = Math.min(raw, input.rule.maxCap);
  return { rake, appliedRuleVersion: input.rule.version, reason: 'applied' as const };
}

export async function previewRake(input: RakeResolutionInput & { pot: number; sawFlop: boolean; vipDiscountBps?: number }) {
  const rule = await resolveActiveRakeRule(input);
  return {
    rule,
    calculation: calculateRake({ totalPot: input.pot, sawFlop: input.sawFlop, isHeadsUp: input.isHeadsUp, vipDiscountBps: input.vipDiscountBps, rule })
  };
}
