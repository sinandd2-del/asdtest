import { randomUUID } from 'node:crypto';
import { applyIntent, createInitialState, resolveShowdown } from '../holdem/state-machine.js';
import { toViewerSnapshot } from '../holdem/snapshot.js';
import type { HandPhase, HoldemTableState, PlayerAction } from '../holdem/types.js';

export type Presence = {
  userId: string;
  sessionId: string;
  connected: boolean;
  role: 'PLAYER' | 'SPECTATOR';
  seatNumber?: number;
  lastHeartbeatAt: number;
};

type HoldemAuditEvent = {
  at: number;
  type: 'hand_start' | 'player_action' | 'timeout_action' | 'phase_advance' | 'showdown' | 'admin_force';
  metadata: Record<string, unknown>;
};

export type HoldemRuntimeState = {
  state: HoldemTableState;
  deckCards: import('../holdem/types.js').Card[];
  actionTimeoutMs: number;
  timeoutAt?: number;
  warningAt?: number;
  events: HoldemAuditEvent[];
};

export type TableRoomState = {
  tableId: string;
  version: number;
  phase: 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
  presences: Presence[];
  holds: Array<{ reservationId: string; userId: string; amount: number; seatNumber: number }>;
  holdem?: HoldemRuntimeState;
};

const tableMap = new Map<string, TableRoomState>();
const processedEvents = new Set<string>();

const PHASE_MAP: Record<HandPhase, TableRoomState['phase']> = {
  waiting: 'WAITING',
  table_ready: 'WAITING',
  dealer_assignment: 'PREFLOP',
  blind_posting: 'PREFLOP',
  preflop: 'PREFLOP',
  flop: 'FLOP',
  turn: 'TURN',
  river: 'RIVER',
  showdown: 'SHOWDOWN',
  hand_complete: 'SHOWDOWN',
  payout_settlement: 'SHOWDOWN',
  next_hand_ready: 'WAITING'
};

export function getOrCreateRoom(tableId: string): TableRoomState {
  const existing = tableMap.get(tableId);
  if (existing) return existing;
  const created: TableRoomState = { tableId, version: 1, phase: 'WAITING', presences: [], holds: [] };
  tableMap.set(tableId, created);
  return created;
}

export function listRooms() {
  return [...tableMap.values()];
}


export function resetTransportStateForTests() {
  tableMap.clear();
  processedEvents.clear();
}
export function dedupeClientEvent(clientEventId?: string): boolean {
  if (!clientEventId) return true;
  if (processedEvents.has(clientEventId)) return false;
  processedEvents.add(clientEventId);
  return true;
}

function updateRoomPhase(room: TableRoomState) {
  room.phase = room.holdem ? PHASE_MAP[room.holdem.state.phase] : 'WAITING';
}

function scheduleActionTimer(room: TableRoomState, now = Date.now()) {
  if (!room.holdem?.state.actingSeat) {
    room.holdem!.timeoutAt = undefined;
    room.holdem!.warningAt = undefined;
    return;
  }
  room.holdem.timeoutAt = now + room.holdem.actionTimeoutMs;
  room.holdem.warningAt = room.holdem.timeoutAt - 5_000;
}

function ensureRuntime(room: TableRoomState) {
  if (room.holdem) return room.holdem;
  const seatedPlayers = room.presences
    .filter((p) => p.role === 'PLAYER' && p.seatNumber)
    .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0));

  if (seatedPlayers.length < 2) {
    throw new Error('not_enough_players');
  }

  const seats = seatedPlayers.map((p) => ({
    userId: p.userId,
    seatNumber: p.seatNumber!,
    stack: Math.max(1, Math.trunc(room.holds.find((h) => h.userId === p.userId && h.seatNumber === p.seatNumber)?.amount ?? 100)),
    connected: p.connected
  }));

  const seed = `${room.tableId}:${room.version}`;
  const deckCards: import('../holdem/types.js').Card[] = [];
  const runtime: HoldemRuntimeState = {
    state: createInitialState({ tableId: room.tableId, seats, smallBlind: 1, bigBlind: 2, testSeed: seed, deckOut: deckCards }),
    deckCards,
    actionTimeoutMs: 20_000,
    events: []
  };

  runtime.events.push({ at: Date.now(), type: 'hand_start', metadata: { handId: runtime.state.handId } });
  room.holdem = runtime;
  updateRoomPhase(room);
  scheduleActionTimer(room);
  room.version += 1;
  return runtime;
}

export function upsertPresence(input: {
  tableId: string;
  userId: string;
  sessionId: string;
  role: 'PLAYER' | 'SPECTATOR';
  seatNumber?: number;
}) {
  const room = getOrCreateRoom(input.tableId);
  const existing = room.presences.find((p) => p.userId === input.userId && p.sessionId === input.sessionId);
  if (existing) {
    existing.connected = true;
    existing.role = input.role;
    existing.seatNumber = input.seatNumber;
    existing.lastHeartbeatAt = Date.now();
  } else {
    room.presences.push({
      userId: input.userId,
      sessionId: input.sessionId,
      connected: true,
      role: input.role,
      seatNumber: input.seatNumber,
      lastHeartbeatAt: Date.now()
    });
  }

  if (room.holdem) {
    const seat = room.holdem.state.seats.find((s) => s.userId === input.userId);
    if (seat) {
      seat.connected = true;
    }
  }

  room.version += 1;
  return room;
}

export function disconnectPresence(tableId: string, userId: string, sessionId: string) {
  const room = getOrCreateRoom(tableId);
  const existing = room.presences.find((p) => p.userId === userId && p.sessionId === sessionId);
  if (existing) {
    existing.connected = false;
    existing.lastHeartbeatAt = Date.now();
    if (room.holdem) {
      const seat = room.holdem.state.seats.find((s) => s.userId === userId);
      if (seat) seat.connected = false;
    }
    room.version += 1;
  }
  return room;
}

export function heartbeat(tableId: string, userId: string, sessionId: string) {
  const room = getOrCreateRoom(tableId);
  const existing = room.presences.find((p) => p.userId === userId && p.sessionId === sessionId);
  if (existing) {
    existing.connected = true;
    existing.lastHeartbeatAt = Date.now();
    if (room.holdem) {
      const seat = room.holdem.state.seats.find((s) => s.userId === userId);
      if (seat) seat.connected = true;
    }
    room.version += 1;
  }
  return room;
}

export function reserveHold(input: { tableId: string; userId: string; reservationId: string; amount: number; seatNumber: number }) {
  const room = getOrCreateRoom(input.tableId);
  room.holds.push({ reservationId: input.reservationId, userId: input.userId, amount: input.amount, seatNumber: input.seatNumber });
  room.version += 1;
  return room;
}

export function releaseHold(tableId: string, reservationId: string) {
  const room = getOrCreateRoom(tableId);
  room.holds = room.holds.filter((h) => h.reservationId !== reservationId);
  room.version += 1;
  return room;
}

export function applyPlayerIntent(input: {
  tableId: string;
  userId: string;
  action: PlayerAction;
  amount?: number;
  expectedVersion: number;
  actionId: string;
  now?: number;
}) {
  const room = getOrCreateRoom(input.tableId);
  const runtime = ensureRuntime(room);

  const seat = runtime.state.seats.find((s) => s.userId === input.userId);
  if (!seat) throw new Error('seat_not_found');

  applyIntent(
    runtime.state,
    {
      actionId: input.actionId,
      userId: input.userId,
      action: input.action,
      amount: input.amount,
      expectedVersion: input.expectedVersion
    },
    runtime.deckCards
  );

  runtime.events.push({ at: input.now ?? Date.now(), type: 'player_action', metadata: { userId: input.userId, action: input.action, amount: input.amount } });

  if (runtime.state.phase === 'showdown') {
    resolveShowdown(runtime.state);
    runtime.events.push({ at: Date.now(), type: 'showdown', metadata: { winners: runtime.state.showdown?.winners ?? [] } });
    const eligible = runtime.state.seats.filter((s) => !s.sitOut && s.stack > 0);
    if (eligible.length >= 2) {
      runtime.deckCards = [];
      runtime.state = createInitialState({
        tableId: room.tableId,
        seats: eligible.map((s) => ({ userId: s.userId, seatNumber: s.seatNumber, stack: s.stack, connected: s.connected })),
        smallBlind: runtime.state.smallBlind,
        bigBlind: runtime.state.bigBlind,
        testSeed: `${room.tableId}:${room.version}:${Date.now()}`,
        deckOut: runtime.deckCards
      });
      runtime.events.push({ at: Date.now(), type: 'hand_start', metadata: { handId: runtime.state.handId } });
    }
  }

  updateRoomPhase(room);
  scheduleActionTimer(room, input.now);
  room.version += 1;
  return room;
}

export function runActionTimeouts(now = Date.now()): Array<{ tableId: string; room: TableRoomState; action: 'check' | 'fold'; timedOutUserId: string }> {
  const results: Array<{ tableId: string; room: TableRoomState; action: 'check' | 'fold'; timedOutUserId: string }> = [];

  for (const room of listRooms()) {
    if (!room.holdem?.timeoutAt || room.holdem.timeoutAt > now || !room.holdem.state.actingSeat) continue;

    const seat = room.holdem.state.seats.find((s) => s.seatNumber === room.holdem?.state.actingSeat);
    if (!seat) continue;

    const callAmount = Math.max(0, room.holdem.state.currentBet - seat.betStreet);
    const fallbackAction: PlayerAction = callAmount > 0 ? 'fold' : 'check';

    applyPlayerIntent({
      tableId: room.tableId,
      userId: seat.userId,
      action: fallbackAction,
      expectedVersion: room.holdem.state.version,
      actionId: `timeout:${room.tableId}:${room.holdem.state.version}:${seat.userId}`,
      now
    });

    room.holdem.events.push({ at: now, type: 'timeout_action', metadata: { userId: seat.userId, action: fallbackAction } });
    results.push({ tableId: room.tableId, room, action: fallbackAction, timedOutUserId: seat.userId });
  }

  return results;
}

export function getViewerSnapshot(tableId: string, viewerUserId?: string, spectator = false) {
  const room = getOrCreateRoom(tableId);
  if (!room.holdem) {
    return {
      snapshotId: randomUUID(),
      tableId: room.tableId,
      version: room.version,
      phase: room.phase,
      holds: room.holds,
      presences: room.presences,
      timer: null,
      hand: null
    };
  }

  return {
    snapshotId: randomUUID(),
    tableId: room.tableId,
    version: room.version,
    phase: room.phase,
    holds: room.holds,
    presences: room.presences,
    timer: {
      timeoutAt: room.holdem.timeoutAt,
      warningAt: room.holdem.warningAt,
      timeoutMs: room.holdem.actionTimeoutMs
    },
    hand: toViewerSnapshot(room.holdem.state, viewerUserId, spectator)
  };
}

export function roomSnapshot(tableId: string) {
  return getViewerSnapshot(tableId);
}

export function detectStuckHand(tableId: string, now = Date.now()) {
  const room = getOrCreateRoom(tableId);
  if (!room.holdem || !room.holdem.timeoutAt || !room.holdem.state.actingSeat) return null;
  if (room.holdem.timeoutAt + 15_000 > now) return null;

  return {
    tableId,
    handId: room.holdem.state.handId,
    phase: room.holdem.state.phase,
    version: room.holdem.state.version,
    timeoutAt: room.holdem.timeoutAt
  };
}

export function forceHandAdvance(tableId: string) {
  const room = getOrCreateRoom(tableId);
  const runtime = ensureRuntime(room);
  if (runtime.state.phase === 'showdown') {
    resolveShowdown(runtime.state);
  } else if (runtime.state.actingSeat) {
    const seat = runtime.state.seats.find((s) => s.seatNumber === runtime.state.actingSeat);
    if (seat) {
      const callAmount = Math.max(0, runtime.state.currentBet - seat.betStreet);
      applyPlayerIntent({
        tableId,
        userId: seat.userId,
        action: callAmount > 0 ? 'fold' : 'check',
        expectedVersion: runtime.state.version,
        actionId: `admin-force:${runtime.state.version}:${seat.userId}`
      });
    }
  }

  runtime.events.push({ at: Date.now(), type: 'admin_force', metadata: { op: 'forceHandAdvance' } });
  return room;
}

export function forceShowdown(tableId: string) {
  const room = getOrCreateRoom(tableId);
  const runtime = ensureRuntime(room);
  runtime.state.phase = 'showdown';
  resolveShowdown(runtime.state);
  runtime.events.push({ at: Date.now(), type: 'admin_force', metadata: { op: 'forceShowdown' } });
  updateRoomPhase(room);
  room.version += 1;
  return room;
}

export function buildRefundUnwindPlan(tableId: string) {
  const room = getOrCreateRoom(tableId);
  if (!room.holdem) return [];

  return room.holdem.state.seats
    .filter((s) => s.committed > 0)
    .map((s) => ({ userId: s.userId, refundAmount: s.committed, reason: 'unrecoverable_hand_state' }));
}

export function getHandAuditView(tableId: string) {
  const room = getOrCreateRoom(tableId);
  if (!room.holdem) return null;
  return {
    tableId,
    handId: room.holdem.state.handId,
    version: room.holdem.state.version,
    phase: room.holdem.state.phase,
    events: room.holdem.events
  };
}
