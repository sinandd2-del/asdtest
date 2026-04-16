import { describe, expect, it } from 'vitest';
import { mobileTableShellInvariants } from '../src/table-transport/mobile-shell-invariants.js';

describe('mobile table shell rendering invariants', () => {
  it('keeps required mobile ux invariants enabled', () => {
    const i = mobileTableShellInvariants();
    expect(i.hasSafeAreaPadding).toBe(true);
    expect(i.hasStickyActionTray).toBe(true);
    expect(i.supportsPortraitCompact).toBe(true);
    expect(i.supportsLandscapeMode).toBe(true);
    expect(i.hasReconnectBanner).toBe(true);
  });
});
