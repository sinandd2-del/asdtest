import { env } from '../shared/env.js';
import { postJson } from './http-client.js';
import type { ChainAdapter, ChainDepositEvent } from './types.js';

export class TronUsdtAdapter implements ChainAdapter {
  network = 'USDT_TRC20' as const;

  async generateAddress(input: { userId: string; asset: string }) {
    return postJson<{ address: string; qrPayload: string }>(`${env.SIGNER_BASE_URL}/trc20/address`, input);
  }

  async lookupTransaction(txHash: string) {
    return postJson<{ confirmations: number; exists: boolean }>(`${env.SIGNER_BASE_URL}/trc20/tx`, { txHash });
  }

  async detectDeposits(address: string): Promise<ChainDepositEvent[]> {
    return postJson<ChainDepositEvent[]>(`${env.SIGNER_BASE_URL}/trc20/deposits`, { address, token: 'USDT' });
  }

  async estimateFee(input: { toAddress: string; amount: number }) {
    const res = await postJson<{ fee: number }>(`${env.SIGNER_BASE_URL}/trc20/estimate-fee`, input);
    return res.fee;
  }

  async buildUnsignedWithdrawal(input: { toAddress: string; amount: number }) {
    return postJson<Record<string, unknown>>(`${env.SIGNER_BASE_URL}/trc20/build-withdrawal`, { ...input, token: 'USDT' });
  }

  async broadcastSignedTransaction(input: { signedPayload: Record<string, unknown> }) {
    return postJson<{ txHash: string }>(`${env.SIGNER_BASE_URL}/trc20/broadcast`, input);
  }

  async syncHotWalletBalance() {
    const res = await postJson<{ balance: number }>(`${env.SIGNER_BASE_URL}/trc20/hot-balance`, { token: 'USDT' });
    return res.balance;
  }

  explorerTxUrl(txHash: string) {
    return `https://tronscan.org/#/transaction/${txHash}`;
  }
}
