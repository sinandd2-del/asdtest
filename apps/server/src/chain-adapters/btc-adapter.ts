import { env } from '../shared/env.js';
import { postJson } from './http-client.js';
import type { ChainAdapter, ChainDepositEvent } from './types.js';

export class BtcAdapter implements ChainAdapter {
  network = 'BTC' as const;

  async generateAddress(input: { userId: string; asset: string }) {
    return postJson<{ address: string; qrPayload: string }>(`${env.SIGNER_BASE_URL}/btc/address`, input);
  }

  async lookupTransaction(txHash: string) {
    return postJson<{ confirmations: number; exists: boolean }>(`${env.SIGNER_BASE_URL}/btc/tx`, { txHash });
  }

  async detectDeposits(address: string): Promise<ChainDepositEvent[]> {
    return postJson<ChainDepositEvent[]>(`${env.SIGNER_BASE_URL}/btc/deposits`, { address });
  }

  async estimateFee(input: { toAddress: string; amount: number }) {
    const res = await postJson<{ fee: number }>(`${env.SIGNER_BASE_URL}/btc/estimate-fee`, input);
    return res.fee;
  }

  async buildUnsignedWithdrawal(input: { toAddress: string; amount: number }) {
    return postJson<Record<string, unknown>>(`${env.SIGNER_BASE_URL}/btc/build-withdrawal`, input);
  }

  async broadcastSignedTransaction(input: { signedPayload: Record<string, unknown> }) {
    return postJson<{ txHash: string }>(`${env.SIGNER_BASE_URL}/btc/broadcast`, input);
  }

  async syncHotWalletBalance() {
    const res = await postJson<{ balance: number }>(`${env.SIGNER_BASE_URL}/btc/hot-balance`, {});
    return res.balance;
  }

  explorerTxUrl(txHash: string) {
    return `https://mempool.space/tx/${txHash}`;
  }
}
