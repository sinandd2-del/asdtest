import { z } from 'zod';

export const passwordRules = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, 'must include lowercase')
  .regex(/[A-Z]/, 'must include uppercase')
  .regex(/[0-9]/, 'must include number')
  .regex(/[^A-Za-z0-9]/, 'must include symbol');

export const usernameRules = z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/);

export const tableActionSchema = z.object({
  tableId: z.string().uuid(),
  action: z.enum(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN', 'SIT_OUT']),
  amount: z.number().nonnegative().optional(),
  expectedVersion: z.number().int().positive().optional(),
  actionId: z.string().min(6).max(128).optional()
});

export const joinTableSchema = z.object({
  tableId: z.string().uuid(),
  seat: z.number().int().min(1).max(9)
});

export const registerSchema = z.object({
  username: usernameRules,
  password: passwordRules,
  email: z.string().email().optional()
});

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(3).max(120),
  password: z.string().min(8).max(128)
});

export const updatePasswordSchema = z.object({
  newPassword: passwordRules
});

export const resetPasswordRequestSchema = z.object({
  usernameOrEmail: z.string().min(3).max(120)
});

export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: passwordRules
});

export const createWithdrawalSchema = z.object({
  asset: z.string().min(2).max(20),
  network: z.enum(['BTC', 'USDT_ERC20', 'USDT_TRC20']),
  amount: z.number().positive(),
  address: z.string().min(10).max(128),
  idempotencyKey: z.string().uuid()
});

export const createDepositAddressSchema = z.object({
  asset: z.string().min(2).max(20),
  network: z.enum(['BTC', 'USDT_ERC20', 'USDT_TRC20'])
});

export type TableActionInput = z.infer<typeof tableActionSchema>;
export type JoinTableInput = z.infer<typeof joinTableSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type ServerTableState = {
  id: string;
  name: string;
  stakes: string;
  maxSeats: number;
  seatedCount: number;
  pot: number;
  actorUserId?: string;
  phase: 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
  rakeInfo?: { percent: number; cap: number; noFlopNoDrop: boolean; headsUpOnly: boolean } | null;
};


export const tableJoinTransportSchema = z.object({
  tableId: z.string().uuid(),
  role: z.enum(['PLAYER', 'SPECTATOR']),
  seatNumber: z.number().int().min(1).max(9).optional(),
  clientEventId: z.string().uuid().optional(),
  reconnectFromVersion: z.number().int().nonnegative().optional()
});

export const buyInReserveSchema = z.object({
  tableId: z.string().uuid(),
  seatNumber: z.number().int().min(1).max(9),
  amount: z.number().positive(),
  walletId: z.string().uuid(),
  clientEventId: z.string().uuid().optional()
});
