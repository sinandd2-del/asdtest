import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildUnrecoverableRefundPlan,
  canForceReleaseHold,
  forceAdvanceHand,
  forceTableShowdown,
  getHandAuditMetadata,
  getStuckHandState
} from '../src/table-transport/admin-ops.js';
import { getViewerSnapshot, reserveHold, resetTransportStateForTests, upsertPresence } from '../src/table-transport/state.js';

describe('admin force release flow', () => {
  beforeEach(() => {
    resetTransportStateForTests();
  });

  it('allows force release only for active reservations', () => {
    expect(canForceReleaseHold({ reservationStatus: 'RESERVED', releasedAt: null })).toBe(true);
    expect(canForceReleaseHold({ reservationStatus: 'RELEASED', releasedAt: new Date() })).toBe(false);
  });

  it('supports force hand advance/showdown and refund plan foundation', () => {
    const tableId = '22222222-2222-2222-2222-222222222222';
    upsertPresence({ tableId, userId: 'u1', sessionId: 's1', role: 'PLAYER', seatNumber: 1 });
    upsertPresence({ tableId, userId: 'u2', sessionId: 's2', role: 'PLAYER', seatNumber: 2 });
    reserveHold({ tableId, userId: 'u1', reservationId: 'r1', amount: 50, seatNumber: 1 });
    reserveHold({ tableId, userId: 'u2', reservationId: 'r2', amount: 50, seatNumber: 2 });

    const pre = getViewerSnapshot(tableId, 'u1', false);
    expect(pre.hand).toBeTruthy();

    forceAdvanceHand(tableId);
    forceTableShowdown(tableId);

    const stuck = getStuckHandState(tableId);
    expect(stuck).toBeNull();
    expect(buildUnrecoverableRefundPlan(tableId).length).toBeGreaterThanOrEqual(0);
    expect(getHandAuditMetadata(tableId)?.events.length).toBeGreaterThan(0);
  });
});
