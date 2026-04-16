import { Router } from 'express';
import { prisma } from '../shared/prisma.js';
import { requireAuth } from '../security/auth-middleware.js';

export const ledgerRouter = Router();

ledgerRouter.get('/my-ledger', requireAuth, async (req, res) => {
  const entries = await prisma.ledgerEntry.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  res.json(
    entries.map((e) => ({
      id: e.id,
      txType: e.txType,
      amount: e.amount.toString(),
      deltaAvailable: e.deltaAvailable.toString(),
      deltaHeld: e.deltaHeld.toString(),
      deltaPending: e.deltaPending.toString(),
      blockchainTxHash: e.blockchainTxHash,
      blockchainNetwork: e.blockchainNetwork,
      reference: e.reference,
      createdAt: e.createdAt
    }))
  );
});
