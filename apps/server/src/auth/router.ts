import { Router, type Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  loginSchema,
  registerSchema,
  resetPasswordConfirmSchema,
  resetPasswordRequestSchema,
  updatePasswordSchema
} from '@poker/contracts';
import { prisma } from '../shared/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../security/auth-tokens.js';
import { writeAuditLog } from '../security/audit.js';
import { env } from '../shared/env.js';
import { hashToken } from '../security/token-hash.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { csrfConfig, issueCsrfToken, requireCsrf } from '../security/csrf.js';
import { authCookieOptions, csrfCookieOptions } from '../security/cookies.js';
import {
  emailResendRateLimit,
  emailVerifyRateLimit,
  loginRateLimit,
  logoutRateLimit,
  passwordResetRateLimit,
  refreshRateLimit
} from '../security/rate-limit.js';
import { requireAuth } from '../security/auth-middleware.js';
import { createUserWalletsForDefaultAssets, flagSuspiciousSession } from '../cashier/service.js';
import { emailLinks, sendEmailWithRetry } from '../notifications/email-service.js';

export const authRouter = Router();

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(env.SESSION_COOKIE_NAME, refreshToken, authCookieOptions());
}

async function issueVerificationEmail(input: { userId: string; email: string }) {
  const rawToken = randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000)
    }
  });

  const links = emailLinks(rawToken);
  await sendEmailWithRetry({
    to: input.email,
    userId: input.userId,
    dedupeKey: `verify:${input.userId}`,
    subject: 'Verify your email',
    html: `<p>Verify your account email by clicking the secure link below:</p><p><a href="${links.verify}">${links.verify}</a></p>`,
    metadata: { flow: 'email_verification' }
  });
}

async function issuePasswordResetEmail(input: { userId: string; email: string }) {
  const rawToken = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 15 * 60_000)
    }
  });

  const links = emailLinks(rawToken);
  await sendEmailWithRetry({
    to: input.email,
    userId: input.userId,
    dedupeKey: `reset:${input.userId}`,
    subject: 'Reset your password',
    html: `<p>Use this secure link to reset your password (expires in 15 minutes):</p><p><a href="${links.reset}">${links.reset}</a></p>`,
    metadata: { flow: 'password_reset' }
  });
}

authRouter.get('/csrf', (_req, res) => {
  const csrfToken = issueCsrfToken(res);
  res.cookie(csrfConfig.cookieName, csrfToken, csrfCookieOptions());
  return res.json({ csrfToken, headerName: csrfConfig.headerName });
});

authRouter.post('/register', loginRateLimit, requireCsrf, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.user.create({
    data: {
      username: parsed.data.username,
      email: parsed.data.email,
      passwordHash,
      displayName: parsed.data.username
    }
  });

  await createUserWalletsForDefaultAssets(user.id);

  if (user.email) {
    await issueVerificationEmail({ userId: user.id, email: user.email });
  }

  return res.status(201).json({ id: user.id, username: user.username, emailVerificationPending: Boolean(user.email) });
});

authRouter.post('/login', loginRateLimit, requireCsrf, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: parsed.data.usernameOrEmail }, { email: parsed.data.usernameOrEmail }]
    }
  });
  const validPassword = user ? await verifyPassword(user.passwordHash, parsed.data.password) : false;
  if (!user || !validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: `Account ${user.status.toLowerCase()}` });
  }

  const fingerprint = (req.headers['x-device-fingerprint'] as string | undefined) ?? undefined;

  const seedRefreshToken = signRefreshToken({ sub: user.id, sessionId: randomUUID(), role: user.role });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(seedRefreshToken),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? 'unknown',
      fingerprint
    }
  });

  if (fingerprint) {
    const existingDevice = await prisma.device.findFirst({ where: { userId: user.id, fingerprint } });
    if (!existingDevice) {
      await flagSuspiciousSession(user.id, session.id, 'new_device_fingerprint');
      await prisma.device.create({
        data: {
          userId: user.id,
          fingerprint,
          ipAddress: req.ip,
          suspicious: true,
          anomalyScore: 40
        }
      });
    }
  }

  const tokenPayload = { sub: user.id, sessionId: session.id, role: user.role };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(refreshToken) } });
  setRefreshCookie(res, refreshToken);

  await writeAuditLog({
    userId: user.id,
    actor: 'user',
    action: 'auth.login',
    ipAddress: req.ip,
    metadata: { sessionId: session.id }
  });

  return res.json({ accessToken, user: { id: user.id, role: user.role, username: user.username, emailVerifiedAt: user.emailVerifiedAt } });
});

authRouter.post('/refresh', refreshRateLimit, requireCsrf, async (req, res) => {
  const refreshToken = req.cookies[env.SESSION_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Missing session cookie' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt || hashToken(refreshToken) !== session.refreshTokenHash) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account unavailable' });
    }

    const nextPayload = { sub: payload.sub, sessionId: payload.sessionId, role: payload.role };
    const nextAccessToken = signAccessToken(nextPayload);
    const nextRefreshToken = signRefreshToken(nextPayload);

    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: hashToken(nextRefreshToken) }
    });

    setRefreshCookie(res, nextRefreshToken);
    return res.json({ accessToken: nextAccessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid session token' });
  }
});

authRouter.post('/logout', logoutRateLimit, requireCsrf, async (req, res) => {
  const refreshToken = req.cookies[env.SESSION_COOKIE_NAME] as string | undefined;
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await prisma.session.update({ where: { id: payload.sessionId }, data: { revokedAt: new Date() } });
    } catch {
      // ignore
    }
  }

  res.clearCookie(env.SESSION_COOKIE_NAME, authCookieOptions());
  return res.json({ ok: true });
});

authRouter.post('/email/verify', emailVerifyRateLimit, requireCsrf, async (req, res) => {
  const token = String(req.body?.token ?? '');
  if (!token || token.length < 32) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  const now = new Date();
  const tokenHash = hashToken(token);
  const tokenRecord = await prisma.emailVerificationToken.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: now }
    }
  });

  if (!tokenRecord) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: tokenRecord.userId }, data: { emailVerifiedAt: now } }),
    prisma.emailVerificationToken.update({ where: { id: tokenRecord.id }, data: { consumedAt: now } })
  ]);

  return res.json({ ok: true });
});

authRouter.post('/email/verify/resend', emailResendRateLimit, requireAuth, requireCsrf, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.email) return res.json({ ok: true });
  if (user.emailVerifiedAt) return res.json({ ok: true, alreadyVerified: true });

  await issueVerificationEmail({ userId: user.id, email: user.email });
  return res.json({ ok: true });
});

authRouter.post('/password/update', requireAuth, requireCsrf, async (req, res) => {
  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) }
  });

  await prisma.session.updateMany({ where: { userId: req.user!.id }, data: { revokedAt: new Date() } });
  return res.json({ ok: true });
});

authRouter.post('/password/reset/request', passwordResetRateLimit, requireCsrf, async (req, res) => {
  const parsed = resetPasswordRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: parsed.data.usernameOrEmail }, { email: parsed.data.usernameOrEmail }]
    }
  });
  if (!user?.email) {
    return res.json({ ok: true });
  }

  await issuePasswordResetEmail({ userId: user.id, email: user.email });
  return res.json({ ok: true });
});

authRouter.post('/password/reset/confirm', passwordResetRateLimit, requireCsrf, async (req, res) => {
  const parsed = resetPasswordConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const now = new Date();
  const tokenHash = hashToken(parsed.data.token);
  const tokenRecord = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: now }
    }
  });

  if (!tokenRecord) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({ where: { id: tokenRecord.id }, data: { consumedAt: now } }),
    prisma.session.updateMany({ where: { userId: tokenRecord.userId, revokedAt: null }, data: { revokedAt: now } })
  ]);

  return res.json({ ok: true });
});
