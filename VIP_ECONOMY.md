# VIP Economy (Foundation)

## Scope delivered
This phase introduces a persisted VIP + rakeback baseline integrated with ledger crediting.

## Data model
- `VIPRule`: level metadata, rakeback rate (`rakebackBps`), points accrual (`pointsPerUsdRake`), active flag.
- `UserVIPState`: user current level, points, contributed rake, claimable rakeback balance.

## API surface
Mounted under `/api/vip`:
- `GET /levels`: active VIP levels.
- `GET /me`: authenticated player VIP state and level list.
- `POST /claim-rakeback`: authenticated rakeback claim to player wallet.
- `POST /admin/rules`: admin/support upsert for VIP rules.

## Ledger integration
Rakeback claim flow appends immutable `VIP_RAKEBACK` ledger transactions and zeroes `rakebackBalance` afterward.

## Current limitations / next steps
- No automatic rake-to-points/rakeback accumulator job yet.
- No seasonal tier reset rules yet.
- No VIP perks service (tickets, boosts, concierge rules) yet.
