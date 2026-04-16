# Installation and Deployment

## Requirements
- Docker + Docker Compose
- Node.js 22+
- npm 10+

## Local bootstrap
1. `cp .env.example .env`
2. `npm install`
3. `docker compose up -d postgres redis signer`
4. `npm run prisma:generate -w @poker/server`
5. `npm run prisma:push -w @poker/server`
6. `npm run prisma:seed -w @poker/server`
7. `npm run dev`

## Docker bootstrap
1. `cp .env.example .env`
2. `docker compose up -d --build`
3. Check health:
   - signer `http://localhost:4500/health`
   - server `http://localhost:4000/health/ready`

## Cashier flow setup
- Keep signer in isolated network/process.
- Configure RPC URLs and signer endpoint via `.env`.
- Do not place private keys in the main app runtime.


## Resend setup (optional email verification/reset delivery)
1. Create a Resend account and verify a sender domain/address.
2. Set `EMAIL_PROVIDER=resend` in `.env`.
3. Set `RESEND_API_KEY` and `EMAIL_FROM`.
4. Set `WEB_BASE_URL` to the public web URL used in email links.
5. Keep `EMAIL_PROVIDER=noop` for local dev if external delivery is not needed.
