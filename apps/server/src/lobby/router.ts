import { Router } from 'express';
import { prisma } from '../shared/prisma.js';
import { resolveActiveRakeRule } from '../holdem/rake-config.js';

export const lobbyRouter = Router();

lobbyRouter.get('/tables', async (_req, res) => {
  const tables = await prisma.table.findMany({
    include: { seats: true },
    where: { status: { in: ['OPEN', 'RUNNING'] } }
  });

  const promos = await prisma.promoCampaign.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, take: 5 });

  const payload = await Promise.all(
    tables.map(async (t) => {
      const [sb, bb] = t.stakes.split('/').map((n) => Number(n));
      const rule = await resolveActiveRakeRule({
        gameType: 'NLHE',
        smallBlind: sb || 0,
        bigBlind: bb || 0,
        tableSize: t.maxSeats,
        isHeadsUp: t.maxSeats === 2,
        currency: 'USDT'
      });

      return {
        id: t.id,
        name: t.name,
        stakes: t.stakes,
        status: t.status,
        maxSeats: t.maxSeats,
        seatedCount: t.seats.length,
        pot: 0,
        phase: t.status === 'OPEN' ? 'WAITING' : 'PREFLOP',
        rakeInfo: rule ? { percent: rule.rakeBps / 100, cap: rule.maxCap, noFlopNoDrop: rule.noFlopNoDrop, headsUpOnly: rule.headsUpOnly } : null
      };
    })
  );

  res.json({ tables: payload, promos, tournamentLobbyPath: '/tournaments', bonusCodePlaceholder: true });
});
