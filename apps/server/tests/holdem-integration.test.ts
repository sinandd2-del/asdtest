import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyPlayerIntent,
  detectStuckHand,
  forceShowdown,
  getHandAuditView,
  getViewerSnapshot,
  reserveHold,
  resetTransportStateForTests,
  runActionTimeouts,
  upsertPresence
} from '../src/table-transport/state.js';

const tableId = '11111111-1111-1111-1111-111111111111';

function setupTwoPlayerHand() {
  upsertPresence({ tableId, userId: 'u1', sessionId: 's1', role: 'PLAYER', seatNumber: 1 });
  upsertPresence({ tableId, userId: 'u2', sessionId: 's2', role: 'PLAYER', seatNumber: 2 });
  reserveHold({ tableId, userId: 'u1', reservationId: 'r1', amount: 100, seatNumber: 1 });
  reserveHold({ tableId, userId: 'u2', reservationId: 'r2', amount: 100, seatNumber: 2 });
}

describe('holdem integration/runtime', () => {
  beforeEach(() => {
    resetTransportStateForTests();
  });

  it('rejects stale snapshot versions', () => {
    setupTwoPlayerHand();
    const snap = getViewerSnapshot(tableId, 'u1', false);
    expect(() =>
      applyPlayerIntent({ tableId, userId: 'u1', action: 'check', expectedVersion: 0, actionId: 'a1' })
    ).toThrow('stale_snapshot');
    expect(snap.hand).toBeTruthy();
  });

  it('rejects duplicate action ids', () => {
    setupTwoPlayerHand();
    const hand = getViewerSnapshot(tableId, 'u1', false).hand!;
    applyPlayerIntent({ tableId, userId: 'u1', action: 'check', expectedVersion: hand.version, actionId: 'dup-1' });
    const nextVersion = getViewerSnapshot(tableId, 'u2', false).hand!.version;
    expect(() =>
      applyPlayerIntent({ tableId, userId: 'u2', action: 'check', expectedVersion: nextVersion, actionId: 'dup-1' })
    ).toThrow('duplicate_action');
  });

  it('progresses through streets and preserves reconnect snapshot', () => {
    setupTwoPlayerHand();
    let v = getViewerSnapshot(tableId, 'u1', false).hand!.version;
    applyPlayerIntent({ tableId, userId: 'u1', action: 'check', expectedVersion: v, actionId: 'a1' });
    v = getViewerSnapshot(tableId, 'u2', false).hand!.version;
    applyPlayerIntent({ tableId, userId: 'u2', action: 'check', expectedVersion: v, actionId: 'a2' });
    const reconnect = getViewerSnapshot(tableId, 'u1', false);
    expect(reconnect.hand?.phase).toBe('flop');
    expect(reconnect.hand?.board.length).toBe(3);
  });

  it('uses check vs fold timeout fallback deterministically', () => {
    setupTwoPlayerHand();
    const start = Date.now();
    const first = getViewerSnapshot(tableId, 'u1', false).hand!;
    applyPlayerIntent({ tableId, userId: 'u1', action: 'bet', amount: 4, expectedVersion: first.version, actionId: 'b1', now: start });

    const to = runActionTimeouts(start + 21_000);
    expect(to.length).toBe(1);
    expect(to[0].action).toBe('fold');
  });

  it('preserves spectator privacy while allowing owner cards', () => {
    setupTwoPlayerHand();
    const p1 = getViewerSnapshot(tableId, 'u1', false);
    const spec = getViewerSnapshot(tableId, undefined, true);
    expect(p1.hand?.seats.find((s) => s.userId === 'u1')?.cards.length).toBe(2);
    expect(spec.hand?.seats.every((s) => s.cards.length === 0)).toBe(true);
  });

  it('handles all-in multiway side pots and showdown payouts', () => {
    upsertPresence({ tableId, userId: 'u1', sessionId: 's1', role: 'PLAYER', seatNumber: 1 });
    upsertPresence({ tableId, userId: 'u2', sessionId: 's2', role: 'PLAYER', seatNumber: 2 });
    upsertPresence({ tableId, userId: 'u3', sessionId: 's3', role: 'PLAYER', seatNumber: 3 });
    reserveHold({ tableId, userId: 'u1', reservationId: 'r1', amount: 30, seatNumber: 1 });
    reserveHold({ tableId, userId: 'u2', reservationId: 'r2', amount: 60, seatNumber: 2 });
    reserveHold({ tableId, userId: 'u3', reservationId: 'r3', amount: 120, seatNumber: 3 });

    let hand = getViewerSnapshot(tableId, 'u1', false).hand!;
    applyPlayerIntent({ tableId, userId: 'u1', action: 'all_in', expectedVersion: hand.version, actionId: 'ai1' });
    hand = getViewerSnapshot(tableId, 'u2', false).hand!;
    applyPlayerIntent({ tableId, userId: 'u2', action: 'all_in', expectedVersion: hand.version, actionId: 'ai2' });
    hand = getViewerSnapshot(tableId, 'u3', false).hand!;
    applyPlayerIntent({ tableId, userId: 'u3', action: 'all_in', expectedVersion: hand.version, actionId: 'ai3' });

    const final = forceShowdown(tableId);
    const settled = final.holdem?.state.showdown?.winners ?? [];
    expect(settled.length).toBeGreaterThan(0);
    expect(settled.reduce((sum, w) => sum + w.amount, 0)).toBeGreaterThan(0);
  });

  it('provides stuck hand detection and audit metadata view', () => {
    setupTwoPlayerHand();
    const snap = getViewerSnapshot(tableId, 'u1', false);
    const timeoutAt = snap.timer?.timeoutAt ?? Date.now();
    const stuck = detectStuckHand(tableId, timeoutAt + 16_000);
    expect(stuck?.tableId).toBe(tableId);
    expect(getHandAuditView(tableId)?.events.length).toBeGreaterThan(0);
  });
});
