import { Router } from 'express';
import { prisma } from '../shared/prisma.js';
import { requireAuth } from '../security/auth-middleware.js';
import { walletSnapshot } from '../ledger/service.js';

export const walletsRouter = Router();

walletsRouter.get('/my-wallets', requireAuth, async (req, res) => {
  const wallets = await prisma.wallet.findMany({ where: { userId: req.user!.id }, orderBy: [{ currency: 'asc' }] });
  res.json(
    wallets.map((w) => ({
      id: w.id,
      currency: w.currency,
      frozen: w.frozen,
      balances: walletSnapshot(w)
    }))
  );
});
