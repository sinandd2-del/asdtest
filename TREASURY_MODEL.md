# Treasury Model

## Internal wallet layers
- `COLD_TREASURY`
- `STANDBY_REFILL`
- `HOT_PAYOUT`

## Policies
- `hotMinBalance`: refill trigger threshold
- `hotMaxBalance`: sweep/review threshold
- `standbyMinBalance`: treasury review threshold

## Movement accounting
- Standby -> Hot refill:
  - standby ledger `TREASURY_SWEEP` (-available)
  - hot ledger `TREASURY_REFILL` (+available)
- Every movement has idempotency key + immutable reference.
