import { Prisma } from '@prisma/client';
import { appendLedgerEntry } from '../ledger/service.js';
import { prisma } from '../shared/prisma.js';

function decimal(v: number) {
  return new Prisma.Decimal(v);
}

export async function createBuyInReservation(input: {
  tableId: string;
  userId: string;
  seatNumber: number;
  amount: number;
  walletId: string;
  idempotencyKey: string;
}) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: input.walletId } });
  if (wallet.availableBalance.lessThan(decimal(input.amount))) {
    throw new Error('Insufficient available balance');
  }

  const holdRef = `table-hold:${input.tableId}:${input.userId}:${input.seatNumber}`;

  await appendLedgerEntry({
    walletId: input.walletId,
    userId: input.userId,
    txType: 'HOLD',
    amount: input.amount,
    deltaAvailable: -input.amount,
    deltaHeld: input.amount,
    deltaPending: 0,
    idempotencyKey: `buyin-hold:${input.idempotencyKey}`,
    reference: holdRef,
    metadata: { tableId: input.tableId, seatNumber: input.seatNumber }
  });

  return prisma.buyInReservation.create({
    data: {
      tableId: input.tableId,
      userId: input.userId,
      walletId: input.walletId,
      seatNumber: input.seatNumber,
      amount: decimal(input.amount),
      holdLedgerRef: holdRef,
      status: 'RESERVED',
      expiresAt: new Date(Date.now() + 120_000)
    }
  });
}

export async function releaseBuyInReservation(reservationId: string, reason: string) {
  const reservation = await prisma.buyInReservation.findUniqueOrThrow({ where: { id: reservationId } });
  if (reservation.releasedAt) return reservation;

  await appendLedgerEntry({
    walletId: reservation.walletId,
    userId: reservation.userId,
    txType: 'RELEASE',
    amount: Number(reservation.amount),
    deltaAvailable: Number(reservation.amount),
    deltaHeld: -Number(reservation.amount),
    deltaPending: 0,
    idempotencyKey: `buyin-release:${reservation.id}`,
    reference: reservation.holdLedgerRef,
    metadata: { reservationId: reservation.id, reason }
  });

  return prisma.buyInReservation.update({
    where: { id: reservation.id },
    data: { status: 'RELEASED', releasedAt: new Date() }
  });
}

export async function listStuckReservations() {
  return prisma.buyInReservation.findMany({
    where: {
      status: 'RESERVED',
      expiresAt: { lt: new Date() },
      releasedAt: null
    },
    orderBy: { expiresAt: 'asc' }
  });
}

export async function restoreReconnectSnapshot(tableId: string, userId: string) {
  const [reservation, presences] = await Promise.all([
    prisma.buyInReservation.findFirst({
      where: { tableId, userId, status: 'RESERVED' },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.tablePresence.findMany({ where: { tableId, userId }, orderBy: { joinedAt: 'desc' }, take: 5 })
  ]);

  return { reservation, presences };
}

export async function recoverStuckReservations() {
  const stuck = await listStuckReservations();
  for (const reservation of stuck) {
    await releaseBuyInReservation(reservation.id, 'stuck_timeout_recovery');
  }
  return stuck.length;
}
