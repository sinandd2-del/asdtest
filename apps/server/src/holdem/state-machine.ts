import { randomUUID } from 'node:crypto';
import { createDeck, dealCard, shuffleDeck } from './deck.js';
import { evaluateSeven } from './evaluator.js';
import { buildSidePots } from './pot.js';
import type { Card, HoldemTableState, PlayerIntent, SeatState } from './types.js';

export function createInitialState(input: {
  tableId: string;
  seats: Array<{ userId: string; seatNumber: number; stack: number; connected: boolean }>;
  smallBlind: number;
  bigBlind: number;
  testSeed?: string;
  deckOut?: Card[];
}): HoldemTableState {
  const deck = shuffleDeck(createDeck(), testSeed);
  const seatStates: SeatState[] = input.seats
    .sort((a, b) => a.seatNumber - b.seatNumber)
    .map((s) => ({
    userId: s.userId,
    seatNumber: s.seatNumber,
    stack: s.stack,
    inHand: true,
    folded: false,
    allIn: false,
    sitOut: false,
    betStreet: 0,
    committed: 0,
    holeCards: [dealCard(deck.cards), dealCard(deck.cards)],
    connected: s.connected
  }));

  input.deckOut?.push(...deck.cards);

  const dealerSeat = seatStates[0]?.seatNumber;
  const sbSeat = nextActingSeat(
    {
      tableId: input.tableId,
      handId: 'seed',
      version: 0,
      phase: 'waiting',
      dealerSeat,
      actingSeat: dealerSeat,
      smallBlind: input.smallBlind,
      bigBlind: input.bigBlind,
      minRaise: input.bigBlind,
      currentBet: 0,
      pot: 0,
      sidePots: [],
      board: [],
      burn: [],
      seats: seatStates,
      deckRef: deck.ref,
      actionNonce: new Set<string>(),
      lastActionAt: Date.now(),
      startedAt: Date.now()
    },
    dealerSeat
  );
  const bbSeat = sbSeat ? nextActingSeat(
    {
      tableId: input.tableId,
      handId: 'seed',
      version: 0,
      phase: 'waiting',
      dealerSeat,
      actingSeat: sbSeat,
      smallBlind: input.smallBlind,
      bigBlind: input.bigBlind,
      minRaise: input.bigBlind,
      currentBet: 0,
      pot: 0,
      sidePots: [],
      board: [],
      burn: [],
      seats: seatStates,
      deckRef: deck.ref,
      actionNonce: new Set<string>(),
      lastActionAt: Date.now(),
      startedAt: Date.now()
    },
    sbSeat
  ) : undefined;

  if (sbSeat) {
    const sb = seatStates.find((s) => s.seatNumber === sbSeat);
    if (sb) applyBet(sb, Math.min(input.smallBlind, sb.stack));
  }
  if (bbSeat) {
    const bb = seatStates.find((s) => s.seatNumber === bbSeat);
    if (bb) applyBet(bb, Math.min(input.bigBlind, bb.stack));
  }

  const currentBet = Math.max(...seatStates.map((s) => s.betStreet), 0);
  const actingSeat = bbSeat ? nextActingSeat(
    {
      tableId: input.tableId,
      handId: 'seed',
      version: 0,
      phase: 'preflop',
      dealerSeat,
      actingSeat: bbSeat,
      smallBlind: input.smallBlind,
      bigBlind: input.bigBlind,
      minRaise: input.bigBlind,
      currentBet,
      pot: seatStates.reduce((sum, s) => sum + s.committed, 0),
      sidePots: [],
      board: [],
      burn: [],
      seats: seatStates,
      deckRef: deck.ref,
      actionNonce: new Set<string>(),
      lastActionAt: Date.now(),
      startedAt: Date.now()
    },
    bbSeat
  ) : dealerSeat;

  return {
    tableId: input.tableId,
    handId: randomUUID(),
    version: 1,
    phase: 'preflop',
    dealerSeat,
    actingSeat,
    smallBlind: input.smallBlind,
    bigBlind: input.bigBlind,
    minRaise: input.bigBlind,
    currentBet,
    pot: seatStates.reduce((sum, s) => sum + s.committed, 0),
    sidePots: [],
    board: [],
    burn: [],
    seats: seatStates,
    deckRef: deck.ref,
    actionNonce: new Set<string>(),
    lastActionAt: Date.now(),
    startedAt: Date.now()
  };
}

function seatByUser(state: HoldemTableState, userId: string) {
  return state.seats.find((s) => s.userId === userId);
}

function nextActingSeat(state: HoldemTableState, fromSeat?: number): number | undefined {
  const ordered = [...state.seats].sort((a, b) => a.seatNumber - b.seatNumber);
  if (ordered.length === 0) return undefined;
  const start = fromSeat ? ordered.findIndex((s) => s.seatNumber === fromSeat) : 0;
  for (let i = 1; i <= ordered.length; i += 1) {
    const candidate = ordered[(start + i) % ordered.length];
    if (candidate.inHand && !candidate.folded && !candidate.allIn && !candidate.sitOut) {
      return candidate.seatNumber;
    }
  }
  return undefined;
}

function applyBet(seat: SeatState, amount: number) {
  if (seat.stack < amount) {
    throw new Error('insufficient_stack');
  }
  seat.stack -= amount;
  seat.betStreet += amount;
  seat.committed += amount;
  if (seat.stack === 0) seat.allIn = true;
}

export function validateAction(state: HoldemTableState, intent: PlayerIntent) {
  if (state.actionNonce.has(intent.actionId)) throw new Error('duplicate_action');
  if (intent.expectedVersion !== state.version) throw new Error('stale_snapshot');
  const seat = seatByUser(state, intent.userId);
  if (!seat || !seat.inHand || seat.folded) throw new Error('not_in_hand');
  if (state.actingSeat !== seat.seatNumber) throw new Error('not_your_turn');

  const callAmount = Math.max(0, state.currentBet - seat.betStreet);

  if (intent.action === 'check' && callAmount > 0) throw new Error('cannot_check');
  if (intent.action === 'call' && callAmount <= 0) throw new Error('nothing_to_call');
  if (intent.action === 'bet' && (intent.amount ?? 0) < state.bigBlind) throw new Error('bet_too_small');
  if (intent.action === 'raise') {
    const raiseTo = intent.amount ?? 0;
    if (raiseTo < state.currentBet + state.minRaise) throw new Error('min_raise_violation');
  }
}

function streetDone(state: HoldemTableState) {
  const contenders = state.seats.filter((s) => s.inHand && !s.folded);
  if (contenders.length <= 1) return true;
  const target = Math.max(...contenders.map((s) => s.betStreet));
  return contenders.every((s) => s.allIn || s.betStreet === target);
}

function resetStreetBets(state: HoldemTableState) {
  state.seats.forEach((s) => {
    s.betStreet = 0;
  });
  state.currentBet = 0;
}

function dealBoard(state: HoldemTableState, deckCards: Card[], count: number) {
  state.burn.push(dealCard(deckCards));
  for (let i = 0; i < count; i += 1) {
    state.board.push(dealCard(deckCards));
  }
}

function toNextPhase(state: HoldemTableState, deckCards: Card[]) {
  switch (state.phase) {
    case 'preflop':
      state.phase = 'flop';
      dealBoard(state, deckCards, 3);
      resetStreetBets(state);
      return;
    case 'flop':
      state.phase = 'turn';
      dealBoard(state, deckCards, 1);
      resetStreetBets(state);
      return;
    case 'turn':
      state.phase = 'river';
      dealBoard(state, deckCards, 1);
      resetStreetBets(state);
      return;
    case 'river':
      state.phase = 'showdown';
      return;
    case 'showdown':
      state.phase = 'hand_complete';
      return;
    case 'hand_complete':
      state.phase = 'payout_settlement';
      return;
    case 'payout_settlement':
      state.phase = 'next_hand_ready';
      return;
    default:
      return;
  }
}

export function applyIntent(state: HoldemTableState, intent: PlayerIntent, deckCards: Card[]) {
  validateAction(state, intent);
  const seat = seatByUser(state, intent.userId)!;
  const callAmount = Math.max(0, state.currentBet - seat.betStreet);

  switch (intent.action) {
    case 'fold':
      seat.folded = true;
      break;
    case 'check':
      break;
    case 'call':
      applyBet(seat, callAmount);
      break;
    case 'bet':
      applyBet(seat, intent.amount ?? 0);
      state.currentBet = seat.betStreet;
      state.minRaise = Math.max(state.bigBlind, intent.amount ?? 0);
      break;
    case 'raise': {
      const raiseTo = intent.amount ?? 0;
      const needed = raiseTo - seat.betStreet;
      applyBet(seat, needed);
      state.minRaise = raiseTo - state.currentBet;
      state.currentBet = raiseTo;
      break;
    }
    case 'all_in': {
      const shove = seat.stack;
      applyBet(seat, shove);
      if (seat.betStreet > state.currentBet) {
        state.minRaise = seat.betStreet - state.currentBet;
        state.currentBet = seat.betStreet;
      }
      break;
    }
    case 'sit_out':
      seat.sitOut = true;
      seat.folded = true;
      break;
  }

  state.actionNonce.add(intent.actionId);
  state.pot = state.seats.reduce((sum, s) => sum + s.committed, 0);
  state.sidePots = buildSidePots(state.seats);
  state.version += 1;
  state.lastActionAt = Date.now();

  const remaining = state.seats.filter((s) => s.inHand && !s.folded);
  if (remaining.length <= 1) {
    state.phase = 'showdown';
  } else if (streetDone(state)) {
    toNextPhase(state, deckCards);
  }
  if (state.phase === 'flop' || state.phase === 'turn' || state.phase === 'river') {
    state.actingSeat = nextActingSeat(state, state.dealerSeat);
  } else {
    state.actingSeat = nextActingSeat(state, seat.seatNumber);
  }
}

export function resolveShowdown(state: HoldemTableState) {
  const contenders = state.seats.filter((s) => s.inHand && !s.folded);
  const reveal: Record<string, Card[]> = {};
  const scores = contenders.map((s) => {
    const score = evaluateSeven([...s.holeCards, ...state.board]);
    reveal[s.userId] = s.holeCards;
    return { userId: s.userId, score };
  });
  scores.sort((a, b) => b.score - a.score);

  const sidePots = state.sidePots.length > 0 ? state.sidePots : [{ amount: state.pot, contenders: contenders.map((c) => c.userId) }];
  const payouts: Array<{ userId: string; amount: number; rank: number }> = [];

  for (const pot of sidePots) {
    const eligible = scores.filter((s) => pot.contenders.includes(s.userId));
    const best = Math.max(...eligible.map((e) => e.score));
    const winners = eligible.filter((e) => e.score === best);
    const split = pot.amount / winners.length;
    winners.forEach((w) => payouts.push({ userId: w.userId, amount: split, rank: best }));
  }

  state.showdown = { winners: payouts, reveal };
  for (const payout of payouts) {
    const seat = state.seats.find((s) => s.userId === payout.userId);
    if (seat) {
      seat.stack += payout.amount;
    }
  }
  for (const seat of state.seats) {
    seat.committed = 0;
    seat.betStreet = 0;
    seat.inHand = !seat.sitOut && seat.stack > 0;
    seat.folded = false;
    seat.allIn = false;
  }
  state.pot = 0;
  state.sidePots = [];
  state.phase = 'hand_complete';
  state.version += 1;

  return payouts;
}
