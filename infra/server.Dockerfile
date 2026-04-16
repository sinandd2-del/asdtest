FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/signer/package.json apps/signer/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm install
COPY . .
RUN npm run build -w @poker/contracts && npm run prisma:generate -w @poker/server && npm run build -w @poker/server
CMD ["npm", "run", "start", "-w", "@poker/server"]
