import { describe, expect, it } from 'vitest';
import { isReservationStuck } from '../src/table-transport/timeouts.js';

describe('stuck hold recovery', () => {
  it('detects expired unreleased holds', () => {
    expect(isReservationStuck(new Date(Date.now() - 1000), null)).toBe(true);
    expect(isReservationStuck(new Date(Date.now() + 1000), null)).toBe(false);
  });
});
