import { describe, expect, it } from 'vitest';
import { reduceAction } from '../src/game-engine/state.js';

describe('reduceAction', () => {
  it('adds to pot for bet action', () => {
    const next = reduceAction({ pot: 0, currentBet: 0, toActUserId: 'u1' }, { actorUserId: 'u1', action: 'BET', amount: 50 });
    expect(next.pot).toBe(50);
    expect(next.currentBet).toBe(50);
  });

  it('rejects turn violations', () => {
    expect(() =>
      reduceAction({ pot: 0, currentBet: 0, toActUserId: 'u1' }, { actorUserId: 'u2', action: 'CHECK' })
    ).toThrow('Not your turn');
  });
});
