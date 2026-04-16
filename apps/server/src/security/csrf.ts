import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

export function issueCsrfToken(res: Response): string {
  const token = randomBytes(32).toString('hex');
  return token;
}

function secureEqual(a: string, b: string): boolean {
  const one = Buffer.from(a);
  const two = Buffer.from(b);
  return one.length === two.length && timingSafeEqual(one, two);
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies[CSRF_COOKIE] as string | undefined;
  const headerToken = req.header(CSRF_HEADER);

  if (!cookieToken || !headerToken || !secureEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  next();
}

export const csrfConfig = {
  cookieName: CSRF_COOKIE,
  headerName: CSRF_HEADER
};
