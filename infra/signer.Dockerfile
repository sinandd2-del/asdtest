FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps/signer/package.json apps/signer/package.json
RUN npm install
COPY . .
RUN npm run build -w @poker/signer
CMD ["npm", "run", "start", "-w", "@poker/signer"]
