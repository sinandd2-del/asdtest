# Security

## Implemented
- Argon2id password hashing
- CSRF double-submit foundation
- JWT access + rotated refresh tokens (hashed at rest)
- Password reset tokens hashed at rest
- Account status enforcement (active/frozen/suspended)
- Session + suspicious-device hooks
- Rate limits for auth/admin-sensitive routes
- RBAC for admin modules
- Isolated signing boundary (no app-layer private key shortcuts)
- Backend-authoritative ledger mutation rules

## Cashier-specific controls
- Address whitelist for withdrawals
- Withdrawal hold-before-send model
- Cooldown enforcement
- Risk flags (velocity/amount/session patterns)
- Manual approval queue support

## Remaining hardening
- Distributed global abuse detection
- Hardware-backed signing integration
- Formal sanctions/address screening integration
- Multi-approval payout workflow

- Table transport uses authenticated socket sessions, duplicate event suppression, and server acknowledgements.
