import { Router } from 'express';
import { requireAuth } from '../security/auth-middleware.js';

export const notificationsRouter = Router();

notificationsRouter.get('/feed', requireAuth, async (_req, res) => {
  res.json([]);
});
