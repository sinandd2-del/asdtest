import type { ChainNetwork, ChainAdapter } from './types.js';
import { BtcAdapter } from './btc-adapter.js';
import { EvmUsdtAdapter } from './evm-adapter.js';
import { TronUsdtAdapter } from './tron-adapter.js';

const adapters: Record<ChainNetwork, ChainAdapter> = {
  BTC: new BtcAdapter(),
  USDT_ERC20: new EvmUsdtAdapter(),
  USDT_TRC20: new TronUsdtAdapter()
};

export function getChainAdapter(network: ChainNetwork): ChainAdapter {
  return adapters[network];
}
