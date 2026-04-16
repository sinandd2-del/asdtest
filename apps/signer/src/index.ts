import express from 'express';
import { randomUUID } from 'node:crypto';

const app = express();
app.use(express.json());

type TxRecord = { txHash: string; confirmations: number };
const txStore = new Map<string, TxRecord>();

function mkAddress(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function registerNetwork(prefix: string, path: string) {
  app.post(`/${path}/address`, (_req, res) => {
    const address = mkAddress(prefix);
    res.json({ address, qrPayload: `${path}:${address}` });
  });

  app.post(`/${path}/estimate-fee`, (_req, res) => {
    res.json({ fee: 0.5 });
  });

  app.post(`/${path}/build-withdrawal`, (req, res) => {
    res.json({ unsigned: true, payload: req.body });
  });

  app.post(`/${path}/broadcast`, (_req, res) => {
    const txHash = randomUUID().replace(/-/g, '');
    txStore.set(txHash, { txHash, confirmations: 0 });
    res.json({ txHash });
  });

  app.post(`/${path}/tx`, (req, res) => {
    const txHash = req.body.txHash as string;
    const existing = txStore.get(txHash) ?? { txHash, confirmations: 3 };
    txStore.set(txHash, { ...existing, confirmations: existing.confirmations + 1 });
    res.json({ exists: true, confirmations: txStore.get(txHash)!.confirmations });
  });

  app.post(`/${path}/deposits`, (req, res) => {
    const address = req.body.address as string;
    const txHash = randomUUID().replace(/-/g, '');
    res.json([
      {
        externalEventId: randomUUID(),
        txHash,
        toAddress: address,
        amount: 25,
        confirmations: 3,
        blockNumber: 100,
        rawPayload: { simulated: true }
      }
    ]);
  });

  app.post(`/${path}/hot-balance`, (_req, res) => {
    res.json({ balance: 10000 });
  });
}

registerNetwork('bc1q', 'btc');
registerNetwork('0x', 'erc20');
registerNetwork('T', 'trc20');

app.post('/sign', (req, res) => {
  const signerRef = randomUUID();
  res.json({ signedPayload: { signed: true, ...req.body }, signerRef });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(4500, () => {
  // eslint-disable-next-line no-console
  console.log('signer running on 4500');
});
