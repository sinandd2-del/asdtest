import { runActionTimeouts } from './state.js';

export function isReservationStuck(expiresAt: Date, releasedAt?: Date | null) {
  return !releasedAt && expiresAt.getTime() < Date.now();
}

export function processActionTimeouts(now = Date.now()) {
  return runActionTimeouts(now);
}
