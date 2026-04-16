# Local Smoke Test (Cash Game End-to-End)

## 1) Bootstrap
1. Start Postgres/Redis/services (for example via `docker compose up -d`).
2. Install deps: `npm install`.
3. Generate Prisma client: `npm run prisma:generate -w @poker/server`.
4. Push schema: `npm run prisma:push -w @poker/server`.
5. Seed data: `npm run prisma:seed -w @poker/server`.
6. Start stack: `npm run dev`.

Expected:
- web on `http://localhost:3000`
- server on configured API port
- lobby has seeded tables immediately

## 2) Auth flow
1. Open `/account`.
2. Register user A, then login user A.
3. Open another browser/incognito, register+login user B.

Expected:
- login token persists in local storage
- `/api/users/me` resolves

## 3) Lobby flow
1. Open `/lobby`.
2. Verify seeded tables appear (micro/low/mid/high/heads-up).
3. Click **Join Table** for the same table in both sessions.

Expected:
- each table card shows name, stakes, seats, status, rake summary, join CTA

## 4) Join + buy-in flow
1. In each session open table page.
2. Use **Buy-in** action and reserve funds.
3. Ensure both users are visible in seat ring.

Expected:
- reservation appears in table buy-in panel
- held funds reflected via cashier delta events

## 5) Play one full hand
1. When two funded seats are present, hand starts automatically.
2. Use action tray (`Fold`, `Check`, `Bet 1/2`, `Call`) turn by turn.
3. Continue through preflop, flop, turn, river.

Expected:
- board cards appear street-by-street
- acting seat advances correctly
- invalid/out-of-turn actions rejected

## 6) Showdown and payout
1. Reach showdown.
2. Verify winner appears and pot resolves.
3. Verify next hand begins automatically with remaining stacks.

Expected:
- showdown winner list appears in snapshot
- in-table stacks change based on payout
- new hand starts if 2+ active stacks remain

## 7) Cashier verification
1. Open `/cashier` for same user.
2. Confirm available/held/pending cards and realtime delta messages.

Expected:
- hold/release events are visible in delta and balances

## 8) Admin verification
1. Login as admin (`admin` / seeded password in seed file).
2. Open `/admin`.
3. Verify:
   - live tables list
   - stuck holds count
   - active player list
4. Use admin table controls:
   - create table
   - edit stakes/status
   - force-release stuck hold (if present)

Expected:
- admin table mutations update lobby/live tables
- force release removes stuck hold and releases funds

## 9) Rake verification
1. In admin, inspect rake section and active rule version.
2. During hands, ensure rake metadata and configured rake presentation appear on lobby/table.

Expected:
- rake rule is visible in admin and reflected in lobby/table info
