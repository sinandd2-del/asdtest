import { EventEmitter } from 'node:events';

export type WalletDeltaEvent = {
  userId: string;
  walletId: string;
  deltaAvailable: number;
  deltaHeld: number;
  deltaPending: number;
  reason: string;
  reference: string;
};

class RealtimeBus extends EventEmitter {}

export const realtimeBus = new RealtimeBus();
