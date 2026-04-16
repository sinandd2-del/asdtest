import { describe, expect, it } from 'vitest';
import {
  dedupeClientEvent,
  disconnectPresence,
  getOrCreateRoom,
  reserveHold,
  releaseHold,
  roomSnapshot,
  upsertPresence
} from '../src/table-transport/state.js';

describe('table transport duplicate and reconnect safety', () => {
  it('dedupes duplicate client event ids', () => {
    expect(dedupeClientEvent('evt-1')).toBe(true);
    expect(dedupeClientEvent('evt-1')).toBe(false);
  });

  it('restores reconnect snapshot state', () => {
    const tableId = 'table-a';
    upsertPresence({ tableId, userId: 'u1', sessionId: 's1', role: 'PLAYER', seatNumber: 1 });
    const snap = roomSnapshot(tableId);
    expect(snap.presences.length).toBeGreaterThan(0);
    expect(snap.version).toBeGreaterThan(0);
  });

  it('reserves/releases holds safely', () => {
    const tableId = 'table-h';
    reserveHold({ tableId, userId: 'u1', reservationId: 'r1', amount: 20, seatNumber: 1 });
    expect(getOrCreateRoom(tableId).holds.length).toBe(1);
    releaseHold(tableId, 'r1');
    expect(getOrCreateRoom(tableId).holds.length).toBe(0);
  });

  it('marks disconnect state for presence', () => {
    const tableId = 'table-d';
    upsertPresence({ tableId, userId: 'u2', sessionId: 's2', role: 'PLAYER' });
    disconnectPresence(tableId, 'u2', 's2');
    const p = getOrCreateRoom(tableId).presences[0];
    expect(p.connected).toBe(false);
  });
});
