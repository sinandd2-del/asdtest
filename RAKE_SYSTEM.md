# Rake System

## Persistence model
- Rake rules are persisted in `RakeRuleConfig` (Prisma/Postgres), not in-memory only.
- Each rule stores version, active flag, effective-from timestamp, game/stake/blind/table dimensions, heads-up toggle, no-flop-no-drop, cap, currency, VIP hook fields, actor/audit references, and timestamps.

## Supported rule dimensions
- game type
- stake range
- blind range
- heads-up-only toggle
- table-size range
- no-flop-no-drop toggle
- rake percent (bps)
- max cap
- currency/asset
- VIP discount hook (bps)
- effective-from timestamp
- active/inactive status
- version number

## Rule selection order
1. active persisted rules only
2. matching game/currency
3. matching heads-up/table-size/blind/stake dimensions
4. `effectiveFrom <= settlement time`
5. newest effective timestamp wins, then highest version

## Settlement linkage
- Showdown settlement resolves active rule server-side via DB lookup.
- No-flop-no-drop short-circuits rake when flop not seen.
- Percent rake is computed with VIP discount and capped by max cap.
- RAKE ledger entry is immutable and includes rule version metadata.
- Hand audit metadata stores rake outcome + rule version reference.

## Operational best practices
- prefer scheduling future rules over mutating currently-effective rule economics
- avoid overlapping active windows for identical dimensions
- keep heads-up economics explicit with `headsUpOnly` scoped rules
