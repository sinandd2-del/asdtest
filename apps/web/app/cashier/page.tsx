'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { MobileShell } from '../../components/mobile-shell';
import { API_BASE, apiGet } from '../../lib/api';
import { usePreviewMode } from '../../lib/preview';

type Wallet = { id: string; currency: string; balances: { available: number; held: number; pending: number; total: number } };
type DepositAddress = { id: string; asset: string; network: string; address: string; status: string; metadata?: { qrPayload?: string } };
type Deposit = { id: string; network: string; txHash: string; amount: string; status: string; confirmations: number };
type Withdrawal = { id: string; network: string; amount: string; status: string; toAddress: string };

const previewWallets: Wallet[] = [{ id: 'w1', currency: 'USDT', balances: { available: 420, held: 80, pending: 10, total: 510 } }];
const previewAddresses: DepositAddress[] = [{ id: 'a1', asset: 'USDT', network: 'USDT_ERC20', address: '0xabc123previewaddress', status: 'ACTIVE', metadata: { qrPayload: 'ethereum:0xabc123previewaddress' } }];
const previewDeposits: Record<string, Deposit[]> = {
  pending: [{ id: 'd1', network: 'USDT_ERC20', txHash: '0xpendingtx', amount: '150', status: 'confirming', confirmations: 2 }],
  confirmed: [{ id: 'd2', network: 'USDT_ERC20', txHash: '0xconfirmedtx', amount: '75', status: 'credited', confirmations: 12 }],
  default: []
};
const previewWithdrawals: Record<string, Withdrawal[]> = {
  pending_withdrawal: [{ id: 'wd1', network: 'BTC', amount: '0.02', status: 'pending_approval', toAddress: 'bc1qpreview' }],
  held: [{ id: 'wd2', network: 'USDT_TRC20', amount: '200', status: 'held', toAddress: 'TPreviewAddr' }],
  default: []
};

export default function CashierPage() {
  const queryClient = useQueryClient();
  const preview = usePreviewMode();
  const [delta, setDelta] = useState('');

  const wallets = useQuery({ queryKey: ['wallets'], queryFn: () => apiGet<Wallet[]>('/api/wallets/my-wallets'), enabled: !preview.enabled });
  const addresses = useQuery({ queryKey: ['deposit-addresses'], queryFn: () => apiGet<DepositAddress[]>('/api/cashier/deposit-addresses'), enabled: !preview.enabled });
  const deposits = useQuery({ queryKey: ['deposits'], queryFn: () => apiGet<Deposit[]>('/api/cashier/deposits'), enabled: !preview.enabled });
  const withdrawals = useQuery({ queryKey: ['withdrawals'], queryFn: () => apiGet<Withdrawal[]>('/api/cashier/withdrawals'), enabled: !preview.enabled });

  const previewDelta = preview.enabled && preview.state === 'delta' ? 'HOLD | avail -20 held +20' : '';

  const uiWallets = preview.enabled ? previewWallets : wallets.data ?? [];
  const uiAddresses = preview.enabled ? previewAddresses : addresses.data ?? [];
  const uiDeposits = preview.enabled ? previewDeposits[preview.state] ?? previewDeposits.default : deposits.data ?? [];
  const uiWithdrawals = preview.enabled ? previewWithdrawals[preview.state] ?? previewWithdrawals.default : withdrawals.data ?? [];

  useEffect(() => {
    if (uiWallets[0]) window.localStorage.setItem('walletId', uiWallets[0].id);
  }, [uiWallets]);

  useEffect(() => {
    if (preview.enabled) return;
    const token = window.localStorage.getItem('accessToken');
    if (!token) return;
    const socket = io(API_BASE, { transports: ['websocket'], auth: { token } });
    socket.on('cashier:balance_delta', (event: { reason: string; deltaAvailable: number; deltaHeld: number }) => {
      setDelta(`${event.reason} | avail ${event.deltaAvailable} held ${event.deltaHeld}`);
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    });
    return () => socket.disconnect();
  }, [queryClient, preview.enabled]);

  const createAddress = useMutation({
    mutationFn: async () => {
      if (preview.enabled) return { ok: true };
      const csrf = await fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json());
      return fetch(`${API_BASE}/api/cashier/deposit-address`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken, authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
        body: JSON.stringify({ asset: 'USDT', network: 'USDT_ERC20' })
      }).then((r) => r.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deposit-addresses'] })
  });

  const showQr = preview.enabled && preview.state === 'address';
  const banner = useMemo(() => previewDelta || delta, [previewDelta, delta]);

  return (
    <MobileShell>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Wallet</p>
          <h1 className="text-2xl font-semibold">Cashier</h1>
        </div>
        <button className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-black" onClick={() => createAddress.mutate()}>
          New deposit address
        </button>
      </header>

      <section className="glass-panel p-4">
        <p className="text-sm font-semibold">USDT Wallet Summary</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="metric-card"><p className="text-xs text-slate-400">Available</p><p className="mt-1 text-xl font-semibold">{uiWallets[0]?.balances.available ?? 0}</p></div>
          <div className="metric-card"><p className="text-xs text-slate-400">Held</p><p className="mt-1 text-xl font-semibold">{uiWallets[0]?.balances.held ?? 0}</p></div>
          <div className="metric-card"><p className="text-xs text-slate-400">Pending</p><p className="mt-1 text-xl font-semibold">{uiWallets[0]?.balances.pending ?? 0}</p></div>
          <div className="metric-card"><p className="text-xs text-slate-400">Total</p><p className="mt-1 text-xl font-semibold">{uiWallets[0]?.balances.total ?? 0}</p></div>
        </div>
      </section>

      {banner ? <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">Realtime delta: {banner}</p> : null}

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="glass-panel p-4">
          <h2 className="text-sm font-semibold">Deposit</h2>
          <p className="mt-1 text-xs text-slate-400">Use one of your active wallet addresses.</p>
          <div className="mt-3 space-y-2 text-xs">
            {uiAddresses.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                <p className="font-medium">{a.network} · {a.status}</p>
                <p className="mt-1 break-all text-slate-300">{a.address}</p>
                {showQr ? <p className="mt-2 rounded bg-slate-800 p-2 text-slate-300">QR payload: {a.metadata?.qrPayload}</p> : null}
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel p-4">
          <h2 className="text-sm font-semibold">Withdrawal queue</h2>
          <div className="mt-3 space-y-2 text-xs">
            {uiWithdrawals.length === 0 ? <p className="text-slate-400">No withdrawal events.</p> : null}
            {uiWithdrawals.map((w) => (
              <div key={w.id} className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{w.network} · {w.amount}</p>
                  <span className="rounded-full bg-slate-800 px-2 py-1">{w.status}</span>
                </div>
                <p className="mt-1 break-all text-slate-500">{w.toAddress}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="glass-panel mt-4 p-4 pb-safe">
        <h2 className="text-sm font-semibold">Recent deposit transactions</h2>
        <div className="mt-3 space-y-2 text-xs">
          {uiDeposits.length === 0 ? <p className="text-slate-400">No deposit events.</p> : null}
          {uiDeposits.map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <p className="font-medium">{d.network} · {d.amount}</p>
              <p className="text-slate-400">{d.status} · {d.confirmations} confirmations</p>
              <p className="mt-1 break-all text-slate-500">{d.txHash}</p>
            </div>
          ))}
        </div>
      </section>
    </MobileShell>
  );
}
