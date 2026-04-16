import { Router } from 'express';
import { requireAuth } from '../security/auth-middleware.js';
import { requireCsrf } from '../security/csrf.js';
import { requireRole } from '../security/rbac.js';
import { prisma } from '../shared/prisma.js';
import { appendLedgerEntry } from '../ledger/service.js';

export const promotionsRouter = Router();

promotionsRouter.get('/banners', async (_req, res) => {
  const now = new Date();
  const banners = await prisma.promoCampaign.findMany({ where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { createdAt: 'desc' } });
  res.json(banners);
});

promotionsRouter.post('/bonus-code/redeem', requireAuth, requireCsrf, async (req, res) => {
  const { code } = req.body as { code: string };
  const campaign = await prisma.promoCampaign.findFirst({ where: { bonusCode: code, active: true } });
  if (!campaign) return res.status(400).json({ error: 'INVALID_CODE' });

  const wallet = await prisma.wallet.findFirst({ where: { userId: req.user!.id, layer: 'PLAYER', type: 'PLAYER', currency: 'USDT' } });
  if (!wallet) return res.status(400).json({ error: 'WALLET_NOT_FOUND' });

  const amount = 1;
  await appendLedgerEntry({
    walletId: wallet.id,
    userId: req.user!.id,
    txType: 'BONUS_REWARD',
    amount,
    deltaAvailable: amount,
    deltaHeld: 0,
    deltaPending: 0,
    idempotencyKey: `promo:${campaign.id}:user:${req.user!.id}`,
    reference: `promo:${campaign.id}`,
    metadata: { campaignId: campaign.id }
  });

  await prisma.userRewardWallet.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, bonusBalance: amount, ticketCount: 0 },
    update: { bonusBalance: { increment: amount } }
  });

  res.json({ ok: true, reward: amount });
});

promotionsRouter.post('/tickets/grant', requireAuth, requireRole(['ADMIN', 'SUPPORT']), requireCsrf, async (req, res) => {
  const { userId, count } = req.body as { userId: string; count: number };
  const wallet = await prisma.wallet.findFirst({ where: { userId, layer: 'PLAYER', type: 'PLAYER', currency: 'USDT' } });
  if (!wallet) return res.status(400).json({ error: 'WALLET_NOT_FOUND' });

  await appendLedgerEntry({
    walletId: wallet.id,
    userId,
    txType: 'TOURNAMENT_TICKET',
    amount: count,
    deltaAvailable: 0,
    deltaHeld: 0,
    deltaPending: 0,
    idempotencyKey: `ticket:${userId}:${Date.now()}`,
    reference: `ticket:${userId}`,
    metadata: { count }
  });

  const userWallet = await prisma.userRewardWallet.upsert({ where: { userId }, create: { userId, bonusBalance: 0, ticketCount: count }, update: { ticketCount: { increment: count } } });
  res.json(userWallet);
});

promotionsRouter.post('/admin/campaigns', requireAuth, requireRole(['ADMIN', 'SUPPORT']), requireCsrf, async (req, res) => {
  const { title, body, bannerImageUrl, bonusCode, startsAt, endsAt } = req.body as { title: string; body: string; bannerImageUrl?: string; bonusCode?: string; startsAt?: string; endsAt?: string };
  const campaign = await prisma.promoCampaign.create({ data: { title, body, bannerImageUrl, bonusCode, startsAt: startsAt ? new Date(startsAt) : new Date(), endsAt: endsAt ? new Date(endsAt) : null, active: true } });
  res.status(201).json(campaign);
});
