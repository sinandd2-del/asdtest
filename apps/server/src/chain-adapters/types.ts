export type ChainNetwork = 'BTC' | 'USDT_ERC20' | 'USDT_TRC20';

export type ChainDepositEvent = {
  externalEventId: string;
  txHash: string;
  toAddress: string;
  amount: number;
  confirmations: number;
  blockNumber?: number;
  rawPayload: Record<string, unknown>;
};

export interface ChainAdapter {
  network: ChainNetwork;
  generateAddress(input: { userId: string; asset: string }): Promise<{ address: string; qrPayload: string }>;
  lookupTransaction(txHash: string): Promise<{ confirmations: number; exists: boolean }>;
  detectDeposits(address: string): Promise<ChainDepositEvent[]>;
  estimateFee(input: { toAddress: string; amount: number }): Promise<number>;
  buildUnsignedWithdrawal(input: { toAddress: string; amount: number }): Promise<Record<string, unknown>>;
  broadcastSignedTransaction(input: { signedPayload: Record<string, unknown> }): Promise<{ txHash: string }>;
  syncHotWalletBalance(): Promise<number>;
  explorerTxUrl(txHash: string): string;
}
