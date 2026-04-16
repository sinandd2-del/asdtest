# Tournament System (Foundation)

## Scope delivered
This phase adds a persistence-backed tournament foundation for scheduled MTT and Sit & Go workflows while reusing existing auth, RBAC, wallet, CSRF, and immutable ledger infrastructure.

## Data model
Tournament support is backed by these Prisma models:
- `Tournament`
- `TournamentRegistration`
- `TournamentBlindLevel`
- `TournamentPayoutLadder`
- `TournamentTableAssignment`

The system stores buy-in/fee economics, late registration windows, blind-level scaffolding, payout ladder scaffolding, and per-table seat assignment records.

## API surface
Mounted under `/api/tournaments`:
- `GET /lobby`: Returns `scheduled` and `sitAndGo` buckets for lobby rendering.
- `GET /my`: Returns authenticated player's registrations with tournament context.
- `POST /:tournamentId/register`: Performs registration with policy checks and ledger deductions.
- `POST /:tournamentId/admin/start`: Admin/support start hook.
- `POST /:tournamentId/admin/assign-seat`: Admin/support seat assignment hook.

## Ledger integration
Tournament registration emits immutable ledger entries:
- `TOURNAMENT_BUYIN`
- `TOURNAMENT_FEE`

Prize payout and ticket issuance types are reserved in the enum for downstream payout services:
- `TOURNAMENT_PAYOUT`
- `TOURNAMENT_TICKET`

## Front-end foundation
`/tournaments` renders mobile-friendly MTT/SNG cards and supports authenticated registration via CSRF-protected request flow.

## Current limitations / next steps
- No auto-start scheduler or table-balancing loop yet.
- No blind clock daemon yet.
- No elimination progression or automated payout engine yet.
- No registration cap waitlist handling yet.
