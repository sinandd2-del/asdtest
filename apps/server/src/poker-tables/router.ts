import { Router } from 'express';
import { joinTableSchema } from '@poker/contracts';
import { prisma } from '../shared/prisma.js';
import { requireAuth } from '../security/auth-middleware.js';
import { requireCsrf } from '../security/csrf.js';
import { previewRake } from '../holdem/rake-config.js';

export const pokerTablesRouter = Router();

pokerTablesRouter.post('/join', requireAuth, requireCsrf, async (req, res) => {
  const parsed = joinTableSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const seat = await prisma.tableSeat.create({
    data: {
      tableId: parsed.data.tableId,
      userId: req.user!.id,
      seatNumber: parsed.data.seat,
      stack: 0
    }
  });

  res.status(201).json({ ...seat, stack: seat.stack.toString() });
});

pokerTablesRouter.get('/:tableId/rake-info', async (req, res) => {
  const table = await prisma.table.findUnique({ where: { id: req.params.tableId } });
  if (!table) return res.status(404).json({ error: 'Not found' });
  const [sb, bb] = table.stakes.split('/').map((n) => Number(n));
  const resolved = await previewRake({
    gameType: 'NLHE',
    smallBlind: sb || 0,
    bigBlind: bb || 0,
    tableSize: table.maxSeats,
    isHeadsUp: table.maxSeats === 2,
    currency: 'USDT',
    pot: 100,
    sawFlop: true
  });

  return res.json({
    tableId: table.id,
    rake: resolved.rule
      ? { percent: resolved.rule.rakeBps / 100, cap: resolved.rule.maxCap, noFlopNoDrop: resolved.rule.noFlopNoDrop }
      : null,
    tournamentFeePreview: null
  });
});
