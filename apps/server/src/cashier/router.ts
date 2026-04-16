import { Router } from 'express';
import { createDepositAddressSchema, createWithdrawalSchema } from '@poker/contracts';
import { requireAuth } from '../security/auth-middleware.js';
import { requireCsrf } from '../security/csrf.js';
import {
  addWithdrawalAddress,
  createDepositAddress,
  createWithdrawal,
  ingestDepositEvents,
  syncWithdrawalConfirmations
} from './service.js';
import { prisma } from '../shared/prisma.js';
import { env } from '../shared/env.js';

export const cashierRouter = Router();

cashierRouter.post('/deposit-address', requireAuth, requireCsrf, async (req, res) => {
  const parsed = createDepositAddressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const address = await createDepositAddress({
    userId: req.user!.id,
    asset: parsed.data.asset,
    network: parsed.data.network
  });

  return res.status(201).json(address);
});

cashierRouter.get('/deposit-addresses', requireAuth, async (req, res) => {
  const addresses = await prisma.depositAddress.findMany({
    where: { userId: req.user!.id },
    orderBy: { assignedAt: 'desc' }
  });
  return res.json(addresses);
});

cashierRouter.get('/deposits', requireAuth, async (req, res) => {
  const deposits = await prisma.deposit.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  return res.json(deposits);
});

cashierRouter.post('/withdraw-address', requireAuth, requireCsrf, async (req, res) => {
  const { asset, network, address, nickname } = req.body as {
    asset: string;
    network: 'BTC' | 'USDT_ERC20' | 'USDT_TRC20';
    address: string;
    nickname?: string;
  };

  const whitelist = await addWithdrawalAddress({ userId: req.user!.id, asset, network, address, nickname });
  return res.status(201).json(whitelist);
});

cashierRouter.post('/withdraw', requireAuth, requireCsrf, async (req, res) => {
  const parsed = createWithdrawalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const withdrawal = await createWithdrawal({
    userId: req.user!.id,
    asset: parsed.data.asset,
    network: parsed.data.network,
    amount: parsed.data.amount,
    toAddress: parsed.data.address,
    idempotencyKey: parsed.data.idempotencyKey,
    ipAddress: req.ip
  });

  return res.status(201).json(withdrawal);
});

cashierRouter.get('/withdrawals', requireAuth, async (req, res) => {
  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  return res.json(withdrawals);
});


cashierRouter.use('/watcher', (req, res, next) => {
  const token = req.header('x-watcher-token');
  if (token != env.WATCHER_INGEST_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized watcher' });
  }
  next();
});

cashierRouter.post('/watcher/ingest', async (req, res) => {
  const { network, address } = req.body as { network: 'BTC' | 'USDT_ERC20' | 'USDT_TRC20'; address: string };
  await ingestDepositEvents(network, address);
  return res.json({ ok: true });
});

cashierRouter.post('/watcher/sync-withdrawal/:withdrawalId', async (req, res) => {
  await syncWithdrawalConfirmations(req.params.withdrawalId);
  return res.json({ ok: true });
});
