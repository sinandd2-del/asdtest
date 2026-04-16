# Rake Versioning Guarantees

## Guarantees
- Every persisted rule receives a monotonic version (`max(version)+1`) under transaction.
- Create/edit/activate/deactivate operations run transactionally and perform conflict checks before commit.
- Settlement writes applied `rakeRuleVersion` so historical replay can trace hand economics.
- Idempotency keys (`hand:<id>:rake` and per-winner payout keys) prevent double charging on replay.

## Multi-instance safety foundation
- Rule source of truth is Postgres (`RakeRuleConfig`), not process memory.
- Runtime includes cache invalidation hooks (`updatedAt`-based refresh) so readers can safely refresh across workers.
- Future enhancement: pub/sub invalidation for immediate cache bust across horizontally-scaled nodes.

## Remaining scale risks
- Conflict prevention is application-level transactional logic; add DB-native exclusion strategies where possible.
- Cache refresh currently depends on `updatedAt` polling/read path and may not be instant under extreme churn.
