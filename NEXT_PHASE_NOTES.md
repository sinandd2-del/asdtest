# Next Phase Notes (Product Depth Foundation)

## Integrated in this phase
1. Tournament system foundation with persisted models (`Tournament`, registrations, blind levels, payout ladder, table assignments).
2. Tournament APIs for lobby discovery, registration, late-reg checks, admin start, and seat assignment.
3. VIP economy foundation with persisted rules/state plus rakeback claim flow.
4. Mission foundation with daily mission feed, daily-login progress hook, and reward claim flow.
5. Promotions foundation with active banners, bonus code redeem placeholder, ticket grant, and campaign creation hooks.
6. Ledger expansion for tournament/vip/reward tx types:
   - `TOURNAMENT_BUYIN`, `TOURNAMENT_FEE`, `TOURNAMENT_PAYOUT`
   - `VIP_RAKEBACK`
   - `MISSION_REWARD`
   - `BONUS_REWARD`, `TOURNAMENT_TICKET`
7. Mobile-facing UX expansion:
   - Dedicated tournament lobby route (`/tournaments`),
   - Account/lobby/admin shells expanded for VIP/missions/promotions/tournament management,
   - Active-table switcher foundation in table UX.

## Remaining major product systems
- Tournament runtime orchestration: start scheduler, blind clock, balancing/reseating, elimination progression, payout settlement service.
- Full leaderboard/rank system with season windows and fraud-resistant ranking updates.
- Collusion/anti-bot runtime detection and enforcement service.
- Bonus/promotions abuse controls (limits, anti-farming policies, anomaly detection).
- Mission lifecycle workers (expiry, backfill, retries, reconciliation).

## Security / integrity handoff priorities
1. Anti-collusion graph heuristics (shared table frequency, chip flow patterns, coordinated action timing).
2. Bot-risk signal pipeline (action entropy, device/session reuse, impossible reaction-time patterns).
3. Enforcement framework (shadow limits -> soft restrictions -> hard lock with auditable operator overrides).
4. Immutable review trail linking security actions to ledger/reward/tournament artifacts.

## Scaling handoff priorities
1. Move tournament runtime from request-time hooks to durable workers with queue-backed orchestration.
2. Distribute table/tournament coordination with multi-instance-safe locks and idempotent jobs.
3. Add shard-ready active-table presence/index service for multi-table UX at scale.
4. Introduce per-domain SLOs and backpressure controls (tournaments, rewards, cashier, realtime).

## Documentation added in this phase
- `TOURNAMENT_SYSTEM.md`
- `VIP_ECONOMY.md`
- `REWARDS_SYSTEM.md`
- `MULTI_TABLE_UX.md`
