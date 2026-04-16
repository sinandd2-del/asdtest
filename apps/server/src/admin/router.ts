import { Router } from 'express';
import { adminRateLimit } from '../security/rate-limit.js';
import { requireAuth } from '../security/auth-middleware.js';
import { requireRole } from '../security/rbac.js';
import { prisma } from '../shared/prisma.js';
import { requireCsrf } from '../security/csrf.js';
import { approveWithdrawal } from '../cashier/service.js';
import { applyTreasuryRefill } from '../treasury/service.js';
import { listStuckReservations, releaseBuyInReservation } from '../table-transport/service.js';
import {
  createRakeRule,
  detectRakeConflicts,
  listRakeRules,
  previewRake,
  setRakeRuleActive,
  updateRakeRule
} from '../holdem/rake-config.js';

export const adminRouter = Router();

adminRouter.use(adminRateLimit, requireAuth, requireRole(['ADMIN', 'SUPPORT', 'TREASURY']));

adminRouter.get('/audit-logs', async (_req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(logs);
});

adminRouter.get('/players', async (_req, res) => {
  const players = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, username: true, status: true, createdAt: true, role: true }
  });
  res.json(players);
});

adminRouter.get('/player/:userId', async (req, res) => {
  const [user, wallets, riskFlags] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.params.userId } }),
    prisma.wallet.findMany({ where: { userId: req.params.userId } }),
    prisma.riskFlag.findMany({ where: { userId: req.params.userId }, orderBy: { createdAt: 'desc' }, take: 50 })
  ]);
  res.json({ user, wallets, riskFlags });
});

adminRouter.post('/player/:userId/status', requireCsrf, async (req, res) => {
  const { status } = req.body as { status: 'ACTIVE' | 'FROZEN' | 'SUSPENDED' };
  const user = await prisma.user.update({ where: { id: req.params.userId }, data: { status } });
  await prisma.wallet.updateMany({
    where: { userId: user.id },
    data: { frozen: status !== 'ACTIVE' }
  });
  res.json({ id: user.id, status: user.status });
});

adminRouter.get('/deposits', async (_req, res) => {
  const deposits = await prisma.deposit.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(deposits);
});

adminRouter.get('/withdrawals/pending', async (_req, res) => {
  const withdrawals = await prisma.withdrawal.findMany({
    where: { status: { in: ['PENDING_APPROVAL', 'APPROVED'] } },
    orderBy: { createdAt: 'asc' },
    take: 200
  });
  res.json(withdrawals);
});

adminRouter.post('/withdrawals/:id/approve', requireCsrf, async (req, res) => {
  await approveWithdrawal(req.params.id, req.user!.id);
  res.json({ ok: true });
});

adminRouter.post('/treasury/refill', requireCsrf, async (req, res) => {
  const { currency, amount, idempotencyKey, reference } = req.body as {
    currency: string;
    amount: number;
    idempotencyKey: string;
    reference: string;
  };
  await applyTreasuryRefill({ currency, amount, idempotencyKey, reference });
  res.json({ ok: true });
});

adminRouter.get('/treasury/overview', async (req, res) => {
  const currency = (req.query.currency as string) || 'USDT';
  const wallets = await prisma.wallet.findMany({
    where: { type: 'INTERNAL', currency },
    orderBy: { layer: 'asc' }
  });
  const policy = await prisma.internalWalletPolicy.findUnique({ where: { currency } });
  res.json({ wallets, policy });
});

adminRouter.get('/risk-queue', async (_req, res) => {
  const flags = await prisma.riskFlag.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(flags);
});


adminRouter.get('/tables/live', async (_req, res) => {
  const tables = await prisma.table.findMany({
    where: { status: { in: ['OPEN', 'RUNNING'] } },
    include: {
      presences: { where: { connected: true } },
      reservations: { where: { status: 'RESERVED' } }
    }
  });
  res.json(tables);
});

adminRouter.post('/tables', requireCsrf, async (req, res) => {
  const { name, stakes, maxSeats = 6 } = req.body as { name: string; stakes: string; maxSeats?: number };
  const created = await prisma.table.create({
    data: {
      name,
      stakes,
      maxSeats: Math.max(2, Math.min(9, Number(maxSeats) || 6)),
      status: 'OPEN'
    }
  });
  res.status(201).json(created);
});

adminRouter.patch('/tables/:tableId', requireCsrf, async (req, res) => {
  const { name, stakes, maxSeats, status } = req.body as { name?: string; stakes?: string; maxSeats?: number; status?: 'OPEN' | 'RUNNING' | 'CLOSED' };
  const updated = await prisma.table.update({
    where: { id: req.params.tableId },
    data: {
      ...(name ? { name } : {}),
      ...(stakes ? { stakes } : {}),
      ...(typeof maxSeats === 'number' ? { maxSeats: Math.max(2, Math.min(9, Number(maxSeats))) } : {}),
      ...(status ? { status } : {})
    }
  });
  res.json(updated);
});

adminRouter.get('/tables/stuck-holds', async (_req, res) => {
  const stuck = await listStuckReservations();
  res.json(stuck);
});

adminRouter.post('/tables/force-release-hold/:reservationId', requireCsrf, async (req, res) => {
  const released = await releaseBuyInReservation(req.params.reservationId, 'admin_force_release');
  res.json(released);
});

adminRouter.get('/rake/rules', async (_req, res) => {
  const all = await listRakeRules();
  const now = Date.now();
  const currentEffective = all.find((r) => r.active && new Date(r.effectiveFrom).getTime() <= now) ?? null;
  const recentAudit = await prisma.auditLog.findMany({ where: { action: { startsWith: 'rake.rule.' } }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({
    currentEffective,
    active: all.filter((r) => r.active && new Date(r.effectiveFrom).getTime() <= now),
    upcoming: all.filter((r) => r.active && new Date(r.effectiveFrom).getTime() > now),
    historical: all.filter((r) => !r.active),
    audit: recentAudit
  });
});

adminRouter.post('/rake/rules', requireCsrf, async (req, res) => {
  const conflicts = await detectRakeConflicts(req.body);
  if (conflicts.length > 0 && req.body.active) {
    return res.status(409).json({ error: 'RAKE_CONFLICT', conflicts: conflicts.map((c) => ({ id: c.id, version: c.version, effectiveFrom: c.effectiveFrom })) });
  }
  const created = await createRakeRule({ ...req.body, createdByUserId: req.user?.id });
  res.status(201).json({ created, conflicts });
});

adminRouter.patch('/rake/rules/:id', requireCsrf, async (req, res) => {
  const updated = await updateRakeRule(req.params.id, req.body);
  res.json(updated);
});

adminRouter.post('/rake/rules/:id/activate', requireCsrf, async (req, res) => {
  const updated = await setRakeRuleActive(req.params.id, true);
  res.json(updated);
});

adminRouter.post('/rake/rules/:id/deactivate', requireCsrf, async (req, res) => {
  const updated = await setRakeRuleActive(req.params.id, false);
  res.json(updated);
});

adminRouter.post('/rake/preview', async (req, res) => {
  const result = await previewRake(req.body);
  res.json(result);
});


adminRouter.get('/tournaments/manager', async (_req, res) => {
  const [tournaments, registrations] = await Promise.all([
    prisma.tournament.findMany({ orderBy: { startsAt: 'asc' }, take: 200 }),
    prisma.tournamentRegistration.findMany({ orderBy: { registeredAt: 'desc' }, take: 200 })
  ]);
  res.json({ tournaments, registrations });
});

adminRouter.get('/vip/manager', async (_req, res) => {
  const [rules, users] = await Promise.all([
    prisma.vipRule.findMany({ orderBy: { level: 'asc' } }),
    prisma.userVIPState.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 })
  ]);
  res.json({ rules, users });
});

adminRouter.get('/missions/manager', async (_req, res) => {
  const [templates, progress] = await Promise.all([
    prisma.missionTemplate.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.userMissionProgress.findMany({ orderBy: { id: 'desc' }, take: 300 })
  ]);
  res.json({ templates, progress });
});

adminRouter.get('/promos/manager', async (_req, res) => {
  const campaigns = await prisma.promoCampaign.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ campaigns });
});

adminRouter.get('/rewards/ledger', async (_req, res) => {
  const entries = await prisma.ledgerEntry.findMany({ where: { txType: { in: ['TOURNAMENT_BUYIN', 'TOURNAMENT_FEE', 'TOURNAMENT_PAYOUT', 'VIP_RAKEBACK', 'MISSION_REWARD', 'BONUS_REWARD', 'TOURNAMENT_TICKET'] } }, orderBy: { createdAt: 'desc' }, take: 500 });
  res.json(entries);
});
