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
    if (uiWallets[0]) {
      window.localStorage.setItem('walletId', uiWallets[0].id);
    }
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
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cashier</h1>
          <p className="text-xs text-slate-400">Wallet overview, deposits, withdrawals</p>
        </div>
        {preview.enabled ? <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">Preview: {preview.state}</span> : null}
      </header>

      <button className="mb-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black" onClick={() => createAddress.mutate()}>
        New Deposit Address
      </button>

      {banner ? <p className="mb-2 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-300">Realtime delta: {banner}</p> : null}
      <section className="grid gap-3">
        {uiWallets.map((wallet) => (
          <article key={wallet.id} className="rounded-xl bg-slate-900 p-4">
            <p className="text-xs text-slate-400">{wallet.currency}</p>
            <p className="text-lg font-semibold">Available {wallet.balances.available}</p>
            <p className="text-xs text-slate-400">Held {wallet.balances.held} · Pending {wallet.balances.pending}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 rounded-xl bg-slate-900 p-4">
        <h2 className="font-medium">Deposit addresses</h2>
        <div className="mt-2 grid gap-2">
          {uiAddresses.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-700 p-2 text-xs">
              <p>{a.network}</p>
              <p className="break-all">{a.address}</p>
              {showQr ? <p className="mt-1 rounded bg-slate-800 p-2">QR: {a.metadata?.qrPayload}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl bg-slate-900 p-4">
        <h2 className="font-medium">Deposits</h2>
        <div className="mt-2 grid gap-2 text-xs">
          {uiDeposits.length === 0 ? <p className="text-slate-400">No deposits for this state.</p> : null}
          {uiDeposits.map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-700 p-2">
              <p>{d.network} · {d.amount}</p>
              <p>Status: {d.status} ({d.confirmations} conf)</p>
              <p className="break-all">{d.txHash}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl bg-slate-900 p-4 pb-safe">
        <h2 className="font-medium">Withdrawals</h2>
        <div className="mt-2 grid gap-2 text-xs">
          {uiWithdrawals.length === 0 ? <p className="text-slate-400">No withdrawals for this state.</p> : null}
          {uiWithdrawals.map((w) => (
            <div key={w.id} className="rounded-lg border border-slate-700 p-2">
              <p>{w.network} · {w.amount}</p>
              <p>Status: {w.status}</p>
              <p className="break-all">{w.toAddress}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-950/95 p-2 pb-safe">
        <button className="rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-black">Deposit</button>
        <button className="rounded-lg bg-slate-800 py-3 text-sm">Withdraw</button>
      </div>
    </MobileShell>
  );
}
