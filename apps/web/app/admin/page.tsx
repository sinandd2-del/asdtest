'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MobileShell } from '../../components/mobile-shell';
import { API_BASE, apiGet } from '../../lib/api';
import { usePreviewMode } from '../../lib/preview';

type Player = { id: string; username: string; status: string; role: string };
type LiveTable = { id: string; name: string; stakes: string; status: 'OPEN' | 'RUNNING' | 'CLOSED'; maxSeats: number; presences: Array<{ userId: string }>; reservations: Array<{ id: string; amount: string }> };
type RakeRule = {
  id: string;
  version: number;
  gameType: string;
  headsUpOnly: boolean;
  effectiveFrom: string;
  rakeBps: number;
  maxCap: number;
  stakeMin: number;
  stakeMax: number;
  active: boolean;
};

const previewPlayers: Player[] = [
  { id: 'p1', username: 'shark_1', status: 'ACTIVE', role: 'PLAYER' },
  { id: 'p2', username: 'grinder_2', status: 'SUSPENDED', role: 'PLAYER' },
  { id: 'p3', username: 'ops_admin', status: 'ACTIVE', role: 'ADMIN' }
];
const previewTables: LiveTable[] = [
  { id: 't1', name: 'NL100 Fast', stakes: '0.5/1', status: 'OPEN', maxSeats: 6, presences: [{ userId: 'p1' }, { userId: 'p2' }], reservations: [{ id: 'r1', amount: '100' }] },
  { id: 't2', name: 'PLO25', stakes: '0.1/0.25', status: 'RUNNING', maxSeats: 6, presences: [{ userId: 'p3' }], reservations: [] }
];
const previewRake = {
  active: [{ id: 'rk1', version: 4, gameType: 'NLHE', headsUpOnly: false, effectiveFrom: new Date().toISOString(), rakeBps: 500, maxCap: 3, stakeMin: 0.1, stakeMax: 5, active: true }],
  upcoming: [{ id: 'rk2', version: 5, gameType: 'NLHE', headsUpOnly: true, effectiveFrom: new Date(Date.now() + 86_400_000).toISOString(), rakeBps: 450, maxCap: 2, stakeMin: 0.1, stakeMax: 1, active: true }],
  historical: [{ id: 'rk0', version: 3, gameType: 'NLHE', headsUpOnly: false, effectiveFrom: new Date(Date.now() - 86_400_000).toISOString(), rakeBps: 550, maxCap: 3, stakeMin: 0.1, stakeMax: 5, active: false }],
  audit: [{ id: 'a1', action: 'rake.rule.create', createdAt: new Date().toISOString() }]
};

async function fetchCsrf() {
  return fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json() as Promise<{ csrfToken: string }>);
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const preview = usePreviewMode();
  const [newTable, setNewTable] = useState({ name: 'New Cash Table', stakes: '0.25/0.50', maxSeats: 6 });

  const players = useQuery({ queryKey: ['admin-players'], queryFn: () => apiGet<Player[]>('/api/admin/players'), enabled: !preview.enabled });
  const liveTables = useQuery({ queryKey: ['admin-live-tables'], queryFn: () => apiGet<LiveTable[]>('/api/admin/tables/live'), enabled: !preview.enabled });
  const stuck = useQuery({ queryKey: ['admin-stuck-holds'], queryFn: () => apiGet<Array<{ id: string; amount: string }>>('/api/admin/tables/stuck-holds'), enabled: !preview.enabled });
  const risk = useQuery({ queryKey: ['admin-risk'], queryFn: () => apiGet<Array<{ id: string; severity: string }>>('/api/admin/risk-queue'), enabled: !preview.enabled });
  const rake = useQuery({
    queryKey: ['admin-rake-rules'],
    queryFn: () => apiGet<{ currentEffective: RakeRule | null; active: RakeRule[]; upcoming: RakeRule[]; historical: RakeRule[]; audit: Array<{ id: string; action: string; createdAt: string }> }>('/api/admin/rake/rules'),
    enabled: !preview.enabled
  });

  const createTable = useMutation({
    mutationFn: async () => {
      if (preview.enabled) return;
      const csrf = await fetchCsrf();
      return fetch(`${API_BASE}/api/admin/tables`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken, authorization: `Bearer ${window.localStorage.getItem('accessToken') ?? ''}` },
        body: JSON.stringify(newTable)
      }).then((r) => r.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-live-tables'] })
  });

  const updateTableStatus = useMutation({
    mutationFn: async ({ tableId, status }: { tableId: string; status: 'OPEN' | 'RUNNING' | 'CLOSED' }) => {
      if (preview.enabled) return;
      const csrf = await fetchCsrf();
      return fetch(`${API_BASE}/api/admin/tables/${tableId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken, authorization: `Bearer ${window.localStorage.getItem('accessToken') ?? ''}` },
        body: JSON.stringify({ status })
      }).then((r) => r.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-live-tables'] })
  });

  const forceRelease = useMutation({
    mutationFn: async (reservationId: string) => {
      if (preview.enabled) return;
      const csrf = await fetchCsrf();
      return fetch(`${API_BASE}/api/admin/tables/force-release-hold/${reservationId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken, authorization: `Bearer ${window.localStorage.getItem('accessToken') ?? ''}` }
      }).then((r) => r.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-stuck-holds'] })
  });

  const uiPlayers = preview.enabled ? previewPlayers : players.data ?? [];
  const uiTables = preview.enabled ? previewTables : liveTables.data ?? [];
  const uiRake = preview.enabled ? { ...previewRake, currentEffective: previewRake.active[0] } : rake.data ?? { currentEffective: null, active: [], upcoming: [], historical: [], audit: [] };
  const stuckRows = preview.enabled ? [{ id: 'st1', amount: '80' }] : stuck.data ?? [];
  const riskCount = preview.enabled ? 4 : risk.data?.length ?? 0;

  return (
    <MobileShell>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Operations console</p>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        </div>
      </header>

      <section className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-card"><p className="text-slate-400 text-xs">Live tables</p><p className="mt-1 text-xl font-semibold">{uiTables.length}</p></div>
        <div className="metric-card"><p className="text-slate-400 text-xs">Active players</p><p className="mt-1 text-xl font-semibold">{uiPlayers.filter((p) => p.status === 'ACTIVE').length}</p></div>
        <div className="metric-card"><p className="text-slate-400 text-xs">Risk queue</p><p className="mt-1 text-xl font-semibold text-amber-300">{riskCount}</p></div>
        <div className="metric-card"><p className="text-slate-400 text-xs">Stuck holds</p><p className="mt-1 text-xl font-semibold text-amber-300">{stuckRows.length}</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <article className="glass-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Table management</h2>
          </div>

          <div className="mb-3 grid gap-2 sm:grid-cols-4">
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs" value={newTable.name} onChange={(e) => setNewTable((p) => ({ ...p, name: e.target.value }))} placeholder="Table name" />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs" value={newTable.stakes} onChange={(e) => setNewTable((p) => ({ ...p, stakes: e.target.value }))} placeholder="0.25/0.50" />
            <input className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs" type="number" min={2} max={9} value={newTable.maxSeats} onChange={(e) => setNewTable((p) => ({ ...p, maxSeats: Number(e.target.value) }))} />
            <button className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-semibold text-black" onClick={() => createTable.mutate()}>Create</button>
          </div>

          <div className="space-y-2 text-sm">
            {uiTables.map((table) => (
              <div key={table.id} className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{table.name}</p>
                    <p className="text-xs text-slate-400">{table.stakes} · {table.maxSeats}-max · {table.id.slice(0, 8)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-800 px-2 py-1">{table.status}</span>
                    <button className="rounded bg-slate-800 px-2 py-1" onClick={() => updateTableStatus.mutate({ tableId: table.id, status: 'OPEN' })}>Open</button>
                    <button className="rounded bg-slate-800 px-2 py-1" onClick={() => updateTableStatus.mutate({ tableId: table.id, status: 'CLOSED' })}>Close</button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-400">Presence: {table.presences.length} · Held reservations: {table.reservations.length}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel p-4">
          <h2 className="text-sm font-semibold">Rake control</h2>
          <div className="mt-3 space-y-2 text-xs">
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-slate-400">Current rule</p>
              <p className="font-semibold">{uiRake.currentEffective ? `v${uiRake.currentEffective.version} · ${(uiRake.currentEffective.rakeBps / 100).toFixed(2)}%` : 'None'}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-slate-400">Upcoming</p>
              <p className="font-semibold">{uiRake.upcoming.length} scheduled rule(s)</p>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="glass-panel p-4">
          <h2 className="text-sm font-semibold">Player status board</h2>
          <div className="mt-3 space-y-2 text-sm">
            {uiPlayers.map((player) => (
              <div key={player.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2">
                <div>
                  <p className="font-medium">{player.username}</p>
                  <p className="text-xs text-slate-400">{player.role}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] ${player.status === 'ACTIVE' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                  {player.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel p-4">
          <h2 className="text-sm font-semibold">Stuck holds</h2>
          <div className="mt-3 space-y-2 text-xs">
            {stuckRows.length === 0 ? <p className="text-slate-400">No stuck holds.</p> : null}
            {stuckRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                <p>{row.id.slice(0, 8)} · {row.amount}</p>
                <button className="rounded bg-amber-500/20 px-2 py-1 text-amber-200" onClick={() => forceRelease.mutate(row.id)}>Force release</button>
              </div>
            ))}
          </div>
        </article>
      </section>
    </MobileShell>
  );
}
