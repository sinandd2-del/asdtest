# Poker Platform MVP

Server-authoritative poker platform with privacy-first accounts, self-custody cashier foundation, immutable ledger, and mobile-first web UX.

## Quick start

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis signer
npm run prisma:generate -w @poker/server
npm run prisma:push -w @poker/server
npm run prisma:seed -w @poker/server
npm run dev
```

## One-command setup

```bash
./setup.sh
```

## Default accounts

- Admin: `admin` / `ChangeMe123!@#`

## Core routes

- Auth: `/api/auth/*`
- User account/session/privacy: `/api/users/*`
- Wallets + ledger: `/api/wallets/*`, `/api/ledger/*`
- Cashier: `/api/cashier/*`
- Admin core: `/api/admin/*`

## Security/cashier bootstrap notes

- Fetch CSRF token from `GET /api/auth/csrf` and send `x-csrf-token` for sensitive POST routes.
- Deposit and withdrawal orchestration are backend-authoritative.
- Signing is isolated through `apps/signer` boundary service.

See docs:
- `ARCHITECTURE.md`
- `SECURITY.md`
- `SELF_CUSTODY_ARCHITECTURE.md`
- `CASHIER_SECURITY.md`
- `TREASURY_MODEL.md`
- `CHAIN_ADAPTERS.md`
- `SIGNING_BOUNDARY.md`
- `NEXT_PHASE_NOTES.md`

- `TABLE_TRANSPORT.md`


## UI preview mode

Use deterministic visual fixture routes in development:

- `?preview=1` enables preview mode (ignored in production builds)
- `?state=...` picks a fixture variant
- Full route list: `UI_PREVIEW_ROUTES.md`
