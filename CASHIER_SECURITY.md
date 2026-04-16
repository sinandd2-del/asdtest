# Cashier Security

## Key rules
- Never sign withdrawals in main request handlers with private keys.
- Never credit/debit balances outside ledger append service.
- Never send player withdrawals from cold treasury.
- Always enforce idempotency on deposit and withdrawal mutation paths.

## Current controls
- CSRF for state-changing cashier routes
- Address whitelist
- Withdrawal risk scoring and flag queue
- Hold/release accounting
- Immutable references on ledger entries
