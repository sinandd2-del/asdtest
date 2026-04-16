import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from './shared/env.js';
import { authRouter } from './auth/router.js';
import { usersRouter } from './users/router.js';
import { walletsRouter } from './wallets/router.js';
import { ledgerRouter } from './ledger/router.js';
import { lobbyRouter } from './lobby/router.js';
import { pokerTablesRouter } from './poker-tables/router.js';
import { adminRouter } from './admin/router.js';
import { notificationsRouter } from './notifications/router.js';
import { tournamentsRouter } from './tournaments/router.js';
import { vipRouter } from './vip/router.js';
import { missionsRouter } from './missions/router.js';
import { promotionsRouter } from './promotions/router.js';
import { attachGameEngine } from './game-engine/socket.js';
import { checkDatabaseHealth } from './shared/prisma.js';
import { checkRedisHealth } from './shared/redis.js';
import { cashierRouter } from './cashier/router.js';
import { recoverStuckReservations } from './table-transport/service.js';

const app = express();
app.set('trust proxy', Number(env.TRUST_PROXY));
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/ready', async (_req, res) => {
  try {
    await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);
    return res.json({ status: 'ready' });
  } catch {
    return res.status(503).json({ status: 'degraded' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/wallets', walletsRouter);
app.use('/api/ledger', ledgerRouter);
app.use('/api/lobby', lobbyRouter);
app.use('/api/tables', pokerTablesRouter);
app.use('/api/cashier', cashierRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/vip', vipRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/promotions', promotionsRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.CORS_ORIGIN, credentials: true }
});

attachGameEngine(io);

setInterval(async () => {
  const recovered = await recoverStuckReservations();
  if (recovered > 0) {
    io.emit('admin:stuck_hold_recovered', { recovered, at: new Date().toISOString() });
  }
}, 30_000);

httpServer.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`server running on ${env.PORT}`);
});
