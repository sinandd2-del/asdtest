import { describe, expect, it } from 'vitest';
import { runAdapterContract } from '../src/chain-adapters/contract.js';
import type { ChainAdapter } from '../src/chain-adapters/types.js';

const mockAdapter: ChainAdapter = {
  network: 'BTC',
  async generateAddress() {
    return { address: 'bc1qqqmockaddress', qrPayload: 'bitcoin:bc1qqqmockaddress' };
  },
  async lookupTransaction() {
    return { confirmations: 1, exists: true };
  },
  async detectDeposits() {
    return [];
  },
  async estimateFee() {
    return 0.0001;
  },
  async buildUnsignedWithdrawal() {
    return { raw: 'unsigned' };
  },
  async broadcastSignedTransaction() {
    return { txHash: 'tx-hash' };
  },
  async syncHotWalletBalance() {
    return 10;
  },
  explorerTxUrl(txHash: string) {
    return txHash;
  }
};

describe('chain adapter contract', () => {
  it('satisfies adapter baseline', async () => {
    await expect(runAdapterContract(mockAdapter)).resolves.toBe(true);
  });
});
