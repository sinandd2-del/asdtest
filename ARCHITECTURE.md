# Architecture

## Phase 1.5 extensions
- Privacy-first accounts (username + password, optional email, no mandatory KYC)
- Account/session/device controls with suspicious-session hooks
- Immutable ledger-first balances
- Self-custody multi-wallet treasury model (cold/standby/hot/player)
- Chain adapter abstraction for BTC, USDT ERC20, USDT TRC20
- Blockchain watcher ingestion + confirmation crediting service
- Withdrawal orchestration with isolated signing boundary
- Admin core modules for players/risk/deposits/withdrawals/treasury

## Server-authoritative finance
- No frontend-derived balances
- All balance changes only through ledger append service
- Withdrawal holds and releases are ledger-backed
- Treasury refill/sweep movements are ledger-backed

## Signing boundary
- Main app creates payout intents and signing requests
- `apps/signer` handles signing and chain-specific low-level operations
- Future swap target: HSM/multisig/external signer without backend rewrite

## Table transport extension
- Authenticated Socket.io rooms with heartbeat, ack, dedupe, and snapshot versioning.
- Reconnect-safe table presence and buy-in hold reservation synchronization.
