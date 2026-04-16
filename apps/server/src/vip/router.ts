import { Router } from 'express';
import { requireAuth } from '../security/auth-middleware.js';
import { requireCsrf } from '../security/csrf.js';
import { prisma } from '../shared/prisma.js';
import { appendLedgerEntry } from '../ledger/service.js';
import { requireRole } from '../security/rbac.js';

export const vipRouter = Router();

vipRouter.get('/levels', async (_req, res) => {
  const levels = await prisma.vipRule.findMany({ where: { active: true }, orderBy: { level: 'asc' } });
  res.json(levels);
});

vipRouter.get('/me', requireAuth, async (req, res) => {
  const [state, levels] = await Promise.all([
    prisma.userVIPState.findUnique({ where: { userId: req.user!.id } }),
    prisma.vipRule.findMany({ where: { active: true }, orderBy: { level: 'asc' } })
  ]);
  res.json({ state, levels });
});

vipRouter.post('/claim-rakeback', requireAuth, requireCsrf, async (req, res) => {
  const state = await prisma.userVIPState.findUnique({ where: { userId: req.user!.id } });
  if (!state || Number(state.rakebackBalance) <= 0) return res.status(400).json({ error: 'NO_RAKEBACK' });
  const wallet = await prisma.wallet.findFirst({ where: { userId: req.user!.id, layer: 'PLAYER', type: 'PLAYER', currency: 'USDT' } });
  if (!wallet) return res.status(400).json({ error: 'WALLET_NOT_FOUND' });

  const amount = Number(state.rakebackBalance);
  await appendLedgerEntry({
    walletId: wallet.id,
    userId: req.user!.id,
    txType: 'VIP_RAKEBACK',
    amount,
    deltaAvailable: amount,
    deltaHeld: 0,
    deltaPending: 0,
    idempotencyKey: `vip-rakeback:${req.user!.id}:${state.updatedAt.toISOString()}`,
    reference: `vip:${req.user!.id}`,
    metadata: { level: state.currentLevel }
  });

  await prisma.userVIPState.update({ where: { userId: req.user!.id }, data: { rakebackBalance: 0 } });
  res.json({ ok: true, amount });
});

vipRouter.post('/admin/rules', requireAuth, requireRole(['ADMIN', 'SUPPORT']), requireCsrf, async (req, res) => {
  const { level, label, rakebackBps, pointsPerUsdRake } = req.body as { level: number; label: string; rakebackBps: number; pointsPerUsdRake: number };
  const rule = await prisma.vipRule.upsert({
    where: { level },
    create: { level, label, rakebackBps, pointsPerUsdRake, active: true },
    update: { label, rakebackBps, pointsPerUsdRake }
  });
  res.json(rule);
});
