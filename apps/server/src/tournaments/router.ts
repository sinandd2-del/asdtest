import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../shared/prisma.js';
import { requireAuth } from '../security/auth-middleware.js';
import { requireCsrf } from '../security/csrf.js';
import { appendLedgerEntry } from '../ledger/service.js';
import { requireRole } from '../security/rbac.js';

export const tournamentsRouter = Router();

function decimal(v: number) {
  return new Prisma.Decimal(v);
}

tournamentsRouter.get('/lobby', async (_req, res) => {
  const [scheduled, sitAndGo] = await Promise.all([
    prisma.tournament.findMany({ where: { type: 'MTT', status: { in: ['SCHEDULED', 'REGISTRATION_OPEN', 'LATE_REG_OPEN', 'RUNNING'] } }, orderBy: { startsAt: 'asc' }, include: { _count: { select: { registrations: true } } } }),
    prisma.tournament.findMany({ where: { type: 'SIT_AND_GO', status: { in: ['SCHEDULED', 'REGISTRATION_OPEN', 'RUNNING'] } }, orderBy: { startsAt: 'asc' }, include: { _count: { select: { registrations: true } } } })
  ]);

  res.json({ scheduled, sitAndGo });
});

tournamentsRouter.get('/my', requireAuth, async (req, res) => {
  const regs = await prisma.tournamentRegistration.findMany({ where: { userId: req.user!.id }, include: { tournament: true }, orderBy: { registeredAt: 'desc' } });
  res.json(regs);
});

tournamentsRouter.post('/:tournamentId/register', requireAuth, requireCsrf, async (req, res) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.tournamentId } });
  if (!tournament) return res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
  if (!['SCHEDULED', 'REGISTRATION_OPEN', 'LATE_REG_OPEN'].includes(tournament.status)) {
    return res.status(400).json({ error: 'REGISTRATION_CLOSED' });
  }

  if (tournament.lateRegEndsAt && tournament.lateRegEndsAt.getTime() < Date.now()) {
    return res.status(400).json({ error: 'LATE_REG_CLOSED' });
  }

  const wallet = await prisma.wallet.findFirst({ where: { userId: req.user!.id, layer: 'PLAYER', type: 'PLAYER', currency: tournament.currency } });
  if (!wallet) return res.status(400).json({ error: 'WALLET_NOT_FOUND' });

  const existing = await prisma.tournamentRegistration.findFirst({ where: { tournamentId: tournament.id, userId: req.user!.id } });
  if (existing) return res.json({ ok: true, registration: existing, deduped: true });

  const buyIn = Number(tournament.buyIn);
  const fee = Number(tournament.fee);
  const ref = `tournament:${tournament.id}:user:${req.user!.id}`;

  await appendLedgerEntry({
    walletId: wallet.id,
    userId: req.user!.id,
    txType: 'TOURNAMENT_BUYIN',
    amount: buyIn,
    deltaAvailable: -buyIn,
    deltaHeld: 0,
    deltaPending: 0,
    idempotencyKey: `${ref}:buyin`,
    reference: ref,
    metadata: { tournamentId: tournament.id }
  });

  await appendLedgerEntry({
    walletId: wallet.id,
    userId: req.user!.id,
    txType: 'TOURNAMENT_FEE',
    amount: fee,
    deltaAvailable: -fee,
    deltaHeld: 0,
    deltaPending: 0,
    idempotencyKey: `${ref}:fee`,
    reference: ref,
    metadata: { tournamentId: tournament.id }
  });

  const registration = await prisma.tournamentRegistration.create({ data: { tournamentId: tournament.id, userId: req.user!.id } });
  await prisma.tournament.update({ where: { id: tournament.id }, data: { prizePool: tournament.prizePool.add(decimal(buyIn)) } });

  return res.status(201).json({ ok: true, registration });
});

tournamentsRouter.post('/:tournamentId/admin/start', requireAuth, requireRole(['ADMIN', 'SUPPORT']), requireCsrf, async (req, res) => {
  const updated = await prisma.tournament.update({ where: { id: req.params.tournamentId }, data: { status: 'RUNNING', startsInSeconds: 0 } });
  res.json(updated);
});

tournamentsRouter.post('/:tournamentId/admin/assign-seat', requireAuth, requireRole(['ADMIN', 'SUPPORT']), requireCsrf, async (req, res) => {
  const { tableId, userId, seatNumber } = req.body as { tableId: string; userId: string; seatNumber: number };
  const assignment = await prisma.tournamentTableAssignment.create({ data: { id: randomUUID(), tournamentId: req.params.tournamentId, tableId, userId, seatNumber } });
  res.status(201).json(assignment);
});
