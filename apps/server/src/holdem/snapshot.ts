import type { HoldemTableState } from './types.js';

export function toViewerSnapshot(state: HoldemTableState, viewerUserId?: string, spectator = false) {
  return {
    handId: state.handId,
    tableId: state.tableId,
    version: state.version,
    phase: state.phase,
    dealerSeat: state.dealerSeat,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    currentBet: state.currentBet,
    board: state.board,
    pot: state.pot,
    sidePots: state.sidePots,
    actingSeat: state.actingSeat,
    actionTimerMs: Math.max(0, 20_000 - (Date.now() - state.lastActionAt)),
    seats: state.seats.map((s) => ({
      userId: s.userId,
      seatNumber: s.seatNumber,
      stack: s.stack,
      folded: s.folded,
      connected: s.connected,
      sitOut: s.sitOut,
      cards:
        state.phase === 'showdown' || state.phase === 'hand_complete' || state.phase === 'payout_settlement'
          ? s.holeCards
          : spectator
            ? []
            : s.userId === viewerUserId
              ? s.holeCards
              : []
    })),
    showdown: state.showdown
  };
}
