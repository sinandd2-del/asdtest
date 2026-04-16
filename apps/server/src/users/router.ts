import { Router } from 'express';
import { prisma } from '../shared/prisma.js';
import { requireAuth } from '../security/auth-middleware.js';
import { requireCsrf } from '../security/csrf.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      avatarUrl: true,
      privacyEmailOptIn: true,
      emailVerifiedAt: true,
      createdAt: true
    }
  });
  return res.json(user);
});

usersRouter.get('/sessions', requireAuth, async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.id, revokedAt: null },
    orderBy: { createdAt: 'desc' }
  });
  return res.json(sessions);
});

usersRouter.post('/sessions/revoke/:sessionId', requireAuth, requireCsrf, async (req, res) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.sessionId, userId: req.user!.id }
  });
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return res.json({ ok: true });
});

usersRouter.post('/privacy', requireAuth, requireCsrf, async (req, res) => {
  const { privacyEmailOptIn } = req.body as { privacyEmailOptIn: boolean };
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { privacyEmailOptIn: Boolean(privacyEmailOptIn) }
  });
  return res.json({ id: user.id, privacyEmailOptIn: user.privacyEmailOptIn });
});

usersRouter.post('/avatar', requireAuth, requireCsrf, async (req, res) => {
  const { avatarUrl } = req.body as { avatarUrl: string };
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl } });
  return res.json({ id: user.id, avatarUrl: user.avatarUrl });
});
