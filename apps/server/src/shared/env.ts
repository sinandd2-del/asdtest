import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(24),
  JWT_REFRESH_SECRET: z.string().min(24),
  SESSION_COOKIE_NAME: z.string().default('poker_sid'),
  CORS_ORIGIN: z.string().url(),
  TRUST_PROXY: z.string().default('1'),
  SIGNER_BASE_URL: z.string().url().default('http://signer:4500'),
  BTC_RPC_URL: z.string().url().optional(),
  ERC20_RPC_URL: z.string().url().optional(),
  TRC20_RPC_URL: z.string().url().optional(),
  CASHIER_DEFAULT_CONFIRMATIONS: z.coerce.number().default(3),
  WITHDRAWAL_COOLDOWN_MINUTES: z.coerce.number().default(10),
  WATCHER_INGEST_TOKEN: z.string().min(16).default('dev-watcher-ingest-token'),
  EMAIL_PROVIDER: z.enum(['noop', 'resend']).default('noop'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
});

export const env = envSchema.parse(process.env);
