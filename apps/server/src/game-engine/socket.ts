import { Server } from 'socket.io';
import { buyInReserveSchema, tableActionSchema, tableJoinTransportSchema } from '@poker/contracts';
import { verifyAccessToken } from '../security/auth-tokens.js';
import { realtimeBus } from '../shared/realtime-bus.js';
import {
  applyPlayerIntent,
  dedupeClientEvent,
  disconnectPresence,
  getOrCreateRoom,
  getViewerSnapshot,
  heartbeat,
  listRooms,
  releaseHold,
  reserveHold,
  runActionTimeouts,
  upsertPresence
} from '../table-transport/state.js';
import { createBuyInReservation, releaseBuyInReservation, restoreReconnectSnapshot } from '../table-transport/service.js';
import { prisma } from '../shared/prisma.js';

const actionMap = {
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
  ALL_IN: 'all_in',
  SIT_OUT: 'sit_out'
} as const;

function emitAuthoritativeSnapshot(io: Server, tableId: string) {
  const room = getOrCreateRoom(tableId);
  io.to(`table:${tableId}`).emit('table:snapshot', getViewerSnapshot(tableId, undefined, true));
  for (const presence of room.presences.filter((p) => p.role === 'PLAYER')) {
    io.to(`user:${presence.userId}`).emit('table:private_snapshot', getViewerSnapshot(tableId, presence.userId, false));
  }
}

export function attachGameEngine(io: Server) {
  io.use((socket, next) => {
    const bearer = socket.handshake.auth?.token as string | undefined;
    if (!bearer) {
      return next(new Error('Unauthorized'));
    }

    try {
      const payload = verifyAccessToken(bearer);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.data.sessionId = payload.sessionId;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  realtimeBus.on('wallet:delta', (event) => {
    if (!event.userId) return;
    io.to(`user:${event.userId}`).emit('cashier:balance_delta', event);
  });

  setInterval(() => {
    const updates = runActionTimeouts();
    for (const update of updates) {
      io.to(`table:${update.tableId}`).emit('table:timeout_action', {
        tableId: update.tableId,
        action: update.action,
        timedOutUserId: update.timedOutUserId
      });
      emitAuthoritativeSnapshot(io, update.tableId);
    }
  }, 1_000);

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);

    socket.on('table:join', async (payload, ack) => {
      const parsedJoin = tableJoinTransportSchema.safeParse(payload);
      if (!parsedJoin.success) {
        return ack({ ok: false, error: 'INVALID_JOIN_PAYLOAD' });
      }
      const { tableId, role, seatNumber, clientEventId, reconnectFromVersion } = parsedJoin.data;
      if (!dedupeClientEvent(clientEventId)) {
        return ack({ ok: true, deduped: true });
      }

      socket.join(`table:${tableId}`);
      const room = upsertPresence({
        tableId,
        userId: socket.data.userId,
        sessionId: socket.data.sessionId,
        role,
        seatNumber
      });

      await prisma.tablePresence.upsert({
        where: {
          tableId_userId_sessionId: {
            tableId,
            userId: socket.data.userId,
            sessionId: socket.data.sessionId
          }
        },
        create: {
          tableId,
          userId: socket.data.userId,
          sessionId: socket.data.sessionId,
          role,
          seatNumber,
          connected: true
        },
        update: {
          connected: true,
          role,
          seatNumber,
          lastHeartbeatAt: new Date()
        }
      });

      const reconnect = reconnectFromVersion ? await restoreReconnectSnapshot(tableId, socket.data.userId) : null;
      const snapshot = getViewerSnapshot(tableId, socket.data.userId, role === 'SPECTATOR');

      io.to(`table:${tableId}`).emit('table:presence', {
        tableId,
        version: room.version,
        presences: room.presences
      });

      return ack({ ok: true, snapshot, reconnect });
    });

    socket.on('table:leave', async (payload, ack) => {
      const { tableId, reservationId, clientEventId } = payload as { tableId: string; reservationId?: string; clientEventId?: string };
      if (!dedupeClientEvent(clientEventId)) {
        return ack({ ok: true, deduped: true });
      }

      socket.leave(`table:${tableId}`);
      const room = disconnectPresence(tableId, socket.data.userId, socket.data.sessionId);

      await prisma.tablePresence.updateMany({
        where: { tableId, userId: socket.data.userId, sessionId: socket.data.sessionId },
        data: { connected: false, lastHeartbeatAt: new Date() }
      });

      if (reservationId) {
        await releaseBuyInReservation(reservationId, 'leave_table');
        releaseHold(tableId, reservationId);
      }

      io.to(`table:${tableId}`).emit('table:presence', { tableId, version: room.version, presences: room.presences });
      emitAuthoritativeSnapshot(io, tableId);
      return ack({ ok: true });
    });

    socket.on('table:heartbeat', (payload, ack) => {
      const { tableId, clientEventId } = payload as { tableId: string; clientEventId?: string };
      if (!dedupeClientEvent(clientEventId)) {
        return ack({ ok: true, deduped: true });
      }
      const room = heartbeat(tableId, socket.data.userId, socket.data.sessionId);
      ack({ ok: true, version: room.version, ts: Date.now() });
    });

    socket.on('table:buyin_reserve', async (payload, ack) => {
      const parsedBuyIn = buyInReserveSchema.safeParse(payload);
      if (!parsedBuyIn.success) {
        return ack({ ok: false, error: 'INVALID_BUYIN_PAYLOAD' });
      }
      const { tableId, seatNumber, amount, walletId, clientEventId } = parsedBuyIn.data;
      if (!dedupeClientEvent(clientEventId)) {
        return ack({ ok: true, deduped: true });
      }

      const reservation = await createBuyInReservation({
        tableId,
        userId: socket.data.userId,
        seatNumber,
        amount,
        walletId,
        idempotencyKey: clientEventId ?? `${tableId}:${socket.data.userId}:${Date.now()}`
      });

      const room = reserveHold({
        tableId,
        userId: socket.data.userId,
        reservationId: reservation.id,
        amount,
        seatNumber
      });

      io.to(`table:${tableId}`).emit('table:buyin_state', {
        tableId,
        version: room.version,
        holds: room.holds
      });

      return ack({ ok: true, reservation });
    });

    socket.on('table:buyin_release', async (payload, ack) => {
      const { tableId, reservationId, clientEventId } = payload as { tableId: string; reservationId: string; clientEventId?: string };
      if (!dedupeClientEvent(clientEventId)) {
        return ack({ ok: true, deduped: true });
      }

      await releaseBuyInReservation(reservationId, 'user_cancelled');
      const room = releaseHold(tableId, reservationId);
      io.to(`table:${tableId}`).emit('table:buyin_state', { tableId, version: room.version, holds: room.holds });
      return ack({ ok: true });
    });

    socket.on('table:action', (payload, ack) => {
      const parsed = tableActionSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'INVALID_PAYLOAD' });
      }

      const action = actionMap[parsed.data.action];
      if (!action) {
        return ack({ ok: false, error: 'UNSUPPORTED_ACTION' });
      }

      if (!dedupeClientEvent(parsed.data.actionId)) {
        return ack({ ok: false, error: 'DUPLICATE_ACTION' });
      }

      try {
        const room = getOrCreateRoom(parsed.data.tableId);
        const expectedVersion = parsed.data.expectedVersion ?? room.holdem?.state.version ?? 1;
        const actionId = parsed.data.actionId ?? `${parsed.data.tableId}:${socket.data.userId}:${Date.now()}`;

        applyPlayerIntent({
          tableId: parsed.data.tableId,
          userId: socket.data.userId,
          action,
          amount: parsed.data.amount,
          expectedVersion,
          actionId
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'ACTION_REJECTED';
        return ack({ ok: false, error: message });
      }

      emitAuthoritativeSnapshot(io, parsed.data.tableId);
      return ack({ ok: true, snapshot: getViewerSnapshot(parsed.data.tableId, socket.data.userId, false) });
    });

    socket.on('disconnect', async () => {
      const presences = await prisma.tablePresence.findMany({
        where: { userId: socket.data.userId, sessionId: socket.data.sessionId, connected: true }
      });

      for (const presence of presences) {
        const room = disconnectPresence(presence.tableId, socket.data.userId, socket.data.sessionId);
        await prisma.tablePresence.update({ where: { id: presence.id }, data: { connected: false, lastHeartbeatAt: new Date() } });
        io.to(`table:${presence.tableId}`).emit('table:presence', {
          tableId: presence.tableId,
          version: room.version,
          presences: room.presences,
          alert: 'disconnect'
        });
      }

      for (const room of listRooms()) {
        if (room.presences.some((p) => p.userId === socket.data.userId)) {
          emitAuthoritativeSnapshot(io, room.tableId);
        }
      }
    });
  });
}
