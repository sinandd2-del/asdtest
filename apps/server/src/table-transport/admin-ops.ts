import {
  buildRefundUnwindPlan,
  detectStuckHand,
  forceHandAdvance,
  forceShowdown,
  getHandAuditView
} from './state.js';

export function canForceReleaseHold(input: { reservationStatus: string; releasedAt?: Date | null }) {
  return input.reservationStatus === 'RESERVED' && !input.releasedAt;
}

export function getStuckHandState(tableId: string) {
  return detectStuckHand(tableId);
}

export function forceAdvanceHand(tableId: string) {
  return forceHandAdvance(tableId);
}

export function forceTableShowdown(tableId: string) {
  return forceShowdown(tableId);
}

export function buildUnrecoverableRefundPlan(tableId: string) {
  return buildRefundUnwindPlan(tableId);
}

export function getHandAuditMetadata(tableId: string) {
  return getHandAuditView(tableId);
}
