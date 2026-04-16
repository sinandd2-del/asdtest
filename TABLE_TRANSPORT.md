# Table Transport Layer

## Socket transport features
- Authenticated socket handshake (JWT access token)
- Table rooms (`table:<tableId>`) and user rooms (`user:<userId>`)
- Join/leave + presence events
- Reconnect snapshot restore hooks
- Heartbeat events for liveness
- Snapshot version increments for replay-safe client sync
- Duplicate client event suppression via `clientEventId`
- Acknowledged server events for critical actions
- Wallet/cashier balance delta pushes over realtime bus

## Buy-in hold integration
- `table:buyin_reserve` creates ledger HOLD + `BuyInReservation`
- Reservation binds wallet hold reference to table/user/seat
- `table:buyin_release` creates ledger RELEASE and marks reservation released
- On disconnect/leave/admin force-release, holds can be recovered

## Replay/reconnect safety
- Reconnect payload may include `reconnectFromVersion`
- Server returns latest snapshot + reservation/presence restore
- Client can safely dedupe retransmitted events with `clientEventId`
