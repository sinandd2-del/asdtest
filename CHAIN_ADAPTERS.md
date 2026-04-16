# Chain Adapters

## Supported networks
- BTC
- USDT_ERC20
- USDT_TRC20

## Adapter contract
Each adapter implements:
- address generation
- deposit detection
- tx lookup + confirmations
- fee estimation
- unsigned withdrawal build
- signed tx broadcast
- hot wallet balance sync
- explorer url mapping

## Current implementation note
- Adapter calls are routed to isolated signer service HTTP endpoints.
- Chain-specific RPC internals are intentionally encapsulated in signer boundary.
