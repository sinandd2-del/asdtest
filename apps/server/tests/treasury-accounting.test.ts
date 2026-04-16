import { describe, expect, it } from 'vitest';
import { refillHotFromStandby, sweepHotToStandby } from '../src/treasury/accounting.js';

describe('internal wallet tier accounting', () => {
  it('handles treasury refill and sweep', () => {
    const refilled = refillHotFromStandby({ cold: 1000, standby: 300, hot: 50 }, 100);
    expect(refilled).toEqual({ cold: 1000, standby: 200, hot: 150 });

    const swept = sweepHotToStandby(refilled, 25);
    expect(swept).toEqual({ cold: 1000, standby: 225, hot: 125 });
  });
});
