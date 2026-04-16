import rateLimit from 'express-rate-limit';

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

export const refreshRateLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

export const logoutRateLimit = rateLimit({
  windowMs: 5 * 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false
});

export const adminRateLimit = rateLimit({
  windowMs: 5 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});


export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false
});

export const emailVerifyRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false
});

export const emailResendRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});
