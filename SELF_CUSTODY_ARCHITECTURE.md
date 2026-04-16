# Self-Custody Architecture

## Wallet tiers
1. Cold treasury wallet: reserve storage, non-routine payouts.
2. Standby refill wallet: operational bridge for hot wallet refill.
3. Hot payout wallet: normal withdrawal source with low float policy.
4. Player wallets: ledger-backed balances per asset.

## Deposit model
- Unique per-network deposit addresses per user.
- Chain watcher ingests events.
- Confirmation threshold gates crediting.
- Ledger `DEPOSIT` entry credits available balance.

## Withdrawal model
- Address must be whitelisted.
- Balance validated server-side.
- Hold created via ledger `HOLD`.
- Admin/risk approval + cooldown checks.
- Isolated signer produces signed payload.
- Broadcast and completion tracked.
- Failure path releases hold via ledger `RELEASE`.
