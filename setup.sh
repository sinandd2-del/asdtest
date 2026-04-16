#!/usr/bin/env bash
set -euo pipefail

cp -n .env.example .env || true
npm install
docker compose up -d postgres redis signer
npm run prisma:generate -w @poker/server
npm run prisma:push -w @poker/server
npm run prisma:seed -w @poker/server
docker compose up -d --build server web
