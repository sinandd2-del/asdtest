import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './auth-tokens.js';
import { prisma } from '../shared/prisma.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        sessionId: string;
        role: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = verifyAccessToken(bearer.slice(7));
    const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!session || session.revokedAt || !user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = { id: payload.sub, sessionId: payload.sessionId, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
