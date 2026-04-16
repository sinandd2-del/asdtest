export type HandPhase =
  | 'waiting'
  | 'table_ready'
  | 'dealer_assignment'
  | 'blind_posting'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'hand_complete'
  | 'payout_settlement'
  | 'next_hand_ready';

export type PlayerAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in' | 'sit_out';

export type Card = `${'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A'}${'c'|'d'|'h'|'s'}`;

export type SeatState = {
  userId: string;
  seatNumber: number;
  stack: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  sitOut: boolean;
  betStreet: number;
  committed: number;
  holeCards: Card[];
  connected: boolean;
};

export type SidePot = {
  amount: number;
  contenders: string[];
};

export type HoldemTableState = {
  tableId: string;
  handId: string;
  version: number;
  phase: HandPhase;
  dealerSeat?: number;
  actingSeat?: number;
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
  currentBet: number;
  pot: number;
  sidePots: SidePot[];
  board: Card[];
  burn: Card[];
  seats: SeatState[];
  deckRef: string;
  actionNonce: Set<string>;
  lastActionAt: number;
  startedAt: number;
  showdown?: { winners: Array<{ userId: string; amount: number; rank: number }>; reveal: Record<string, Card[]> };
};

export type PlayerIntent = {
  actionId: string;
  userId: string;
  action: PlayerAction;
  amount?: number;
  expectedVersion: number;
};
