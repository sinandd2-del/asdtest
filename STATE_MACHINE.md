# State Machine Notes

The existing Hold'em state machine is extended, not replaced.

- `createInitialState` now supports `deckOut` capture for runtime street dealing.
- `validateAction` guards stale snapshots and replayed action IDs.
- `applyIntent` updates committed chips, side pots, phase progression, and acting seat.
- `resolveShowdown` computes split payouts over side pots and marks `hand_complete`.

Runtime integration wraps this state machine and adds timer/admin orchestration around it.
