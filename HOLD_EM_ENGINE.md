# Hold'em Engine Integration (Phase 4)

## Runtime wiring
- Engine execution is server-authoritative and runs inside table transport room state.
- Player socket intents are validated against `expectedVersion` and `actionId`.
- Duplicate/replayed actions are rejected by both transport dedupe and engine nonce checks.
- Reconnect uses per-viewer snapshots (owner gets own cards, spectators do not).

## Timer lifecycle
- Each acting seat gets a deterministic timeout window (`20s` default).
- `warningAt` and `timeoutAt` are included in snapshots.
- Timeout fallback is deterministic:
  - if call amount is zero => auto-check
  - else => auto-fold

## Recovery hooks
- Stuck hand detection based on overdue timeout windows.
- Admin force-advance and force-showdown hooks.
- Refund/unwind plan builder for unrecoverable states.
- Audit metadata view exposes hand event history.
