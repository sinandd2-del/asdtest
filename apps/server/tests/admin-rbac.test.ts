import { describe, expect, it } from 'vitest';
import { requireRole } from '../src/security/rbac.js';

describe('admin route protection', () => {
  it('blocks unauthorized role', () => {
    const middleware = requireRole(['ADMIN']);
    const req = { user: { role: 'PLAYER' } } as never;
    const res = { status: () => ({ json: () => 'blocked' }) } as never;
    let called = false;
    middleware(req, res, () => {
      called = true;
    });
    expect(called).toBe(false);
  });
});
