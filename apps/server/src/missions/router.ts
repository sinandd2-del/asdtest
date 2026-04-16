import { Router } from 'express';
import { requireAuth } from '../security/auth-middleware.js';
import { requireCsrf } from '../security/csrf.js';
import { prisma } from '../shared/prisma.js';
import { appendLedgerEntry } from '../ledger/service.js';
import { requireRole } from '../security/rbac.js';

export const missionsRouter = Router();

missionsRouter.get('/daily', requireAuth, async (req, res) => {
  const templates = await prisma.missionTemplate.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });
  const progress = await prisma.userMissionProgress.findMany({ where: { userId: req.user!.id }, include: { missionTemplate: true } });
  res.json({ templates, progress });
});

missionsRouter.post('/daily-login', requireAuth, requireCsrf, async (req, res) => {
  const mission = await prisma.missionTemplate.findFirst({ where: { missionType: 'DAILY_LOGIN', active: true } });
  if (!mission) return res.status(404).json({ error: 'MISSION_NOT_FOUND' });

  const progress = await prisma.userMissionProgress.upsert({
    where: { missionTemplateId_userId: { missionTemplateId: mission.id, userId: req.user!.id } },
    create: { missionTemplateId: mission.id, userId: req.user!.id, progress: 1, streakCount: 1, status: 'ACTIVE', availableUntil: new Date(Date.now() + 24 * 60 * 60_000) },
    update: { progress: 1, streakCount: { increment: 1 }, status: 'ACTIVE', availableUntil: new Date(Date.now() + 24 * 60 * 60_000) }
  });
  res.json(progress);
});

missionsRouter.post('/:missionTemplateId/claim', requireAuth, requireCsrf, async (req, res) => {
  const progress = await prisma.userMissionProgress.findUnique({ where: { missionTemplateId_userId: { missionTemplateId: req.params.missionTemplateId, userId: req.user!.id } }, include: { missionTemplate: true } });
  if (!progress || progress.status !== 'ACTIVE') return res.status(400).json({ error: 'MISSION_NOT_CLAIMABLE' });
  if (progress.progress < progress.missionTemplate.goal) return res.status(400).json({ error: 'MISSION_INCOMPLETE' });

  const wallet = await prisma.wallet.findFirst({ where: { userId: req.user!.id, layer: 'PLAYER', type: 'PLAYER', currency: progress.missionTemplate.currency } });
  if (!wallet) return res.status(400).json({ error: 'WALLET_NOT_FOUND' });
  const reward = Number(progress.missionTemplate.rewardAmount);

  await appendLedgerEntry({
    walletId: wallet.id,
    userId: req.user!.id,
    txType: 'MISSION_REWARD',
    amount: reward,
    deltaAvailable: reward,
    deltaHeld: 0,
    deltaPending: 0,
    idempotencyKey: `mission:${progress.id}:claim`,
    reference: `mission:${progress.id}`,
    metadata: { missionTemplateId: progress.missionTemplate.id }
  });

  await prisma.userMissionProgress.update({ where: { id: progress.id }, data: { status: 'CLAIMED', claimedAt: new Date() } });
  res.json({ ok: true, reward });
});

missionsRouter.post('/admin/templates', requireAuth, requireRole(['ADMIN', 'SUPPORT']), requireCsrf, async (req, res) => {
  const { title, description, missionType, goal, rewardAmount, currency, expiresAt } = req.body as {
    title: string; description: string; missionType: 'DAILY_LOGIN' | 'PLAY_HANDS' | 'STREAK'; goal: number; rewardAmount: number; currency: string; expiresAt?: string;
  };
  const mission = await prisma.missionTemplate.create({ data: { title, description, missionType, goal, rewardAmount, currency, expiresAt: expiresAt ? new Date(expiresAt) : null, active: true } });
  res.status(201).json(mission);
});
