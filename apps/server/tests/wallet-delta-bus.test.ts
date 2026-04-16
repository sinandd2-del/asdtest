import { describe, expect, it } from 'vitest';
import { realtimeBus } from '../src/shared/realtime-bus.js';

describe('balance delta pushes', () => {
  it('emits wallet delta events to subscribers', async () => {
    const received = await new Promise<{ reference: string }>((resolve) => {
      realtimeBus.once('wallet:delta', (event) => resolve(event));
      realtimeBus.emit('wallet:delta', { reference: 'ref-1' });
    });
    expect(received.reference).toBe('ref-1');
  });
});
