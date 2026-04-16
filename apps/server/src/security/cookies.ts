import type { CookieOptions } from 'express';
import { env } from '../shared/env.js';

export function authCookieOptions(): CookieOptions {
  const production = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

export function csrfCookieOptions(): CookieOptions {
  const production = env.NODE_ENV === 'production';
  return {
    httpOnly: false,
    secure: production,
    sameSite: production ? 'strict' : 'lax',
    maxAge: 2 * 60 * 60 * 1000,
    path: '/'
  };
}
