'use client';

import { useQuery } from '@tanstack/react-query';
import { MobileShell } from '../../components/mobile-shell';
import { apiGet } from '../../lib/api';
import { usePreviewMode } from '../../lib/preview';

type Player = { id: string; username: string; status: string; role: string };
type LiveTable = { id: string; name: string; presences: Array<{ userId: string }>; reservations: Array<{ id: string; amount: string }> };
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
  { id: 't1', name: 'NL100 Fast', presences: [{ userId: 'p1' }, { userId: 'p2' }], reservations: [{ id: 'r1', amount: '100' }] },
  { id: 't2', name: 'PLO25', presences: [{ userId: 'p3' }], reservations: [] }
];
const previewRake = {
  active: [{ id: 'rk1', version: 4, gameType: 'NLHE', headsUpOnly: false, effectiveFrom: new Date().toISOString(), rakeBps: 500, maxCap: 3, stakeMin: 0.1, stakeMax: 5, active: true }],
  upcoming: [{ id: 'rk2', version: 5, gameType: 'NLHE', headsUpOnly: true, effectiveFrom: new Date(Date.now() + 86_400_000).toISOString(), rakeBps: 450, maxCap: 2, stakeMin: 0.1, stakeMax: 1, active: true }],
  historical: [{ id: 'rk0', version: 3, gameType: 'NLHE', headsUpOnly: false, effectiveFrom: new Date(Date.now() - 86_400_000).toISOString(), rakeBps: 550, maxCap: 3, stakeMin: 0.1, stakeMax: 5, active: false }],
  audit: [{ id: 'a1', action: 'rake.rule.create', createdAt: new Date().toISOString() }]
};

export default function AdminPage() {
  const preview = usePreviewMode();
  const players = useQuery({ queryKey: ['admin-players'], queryFn: () => apiGet<Player[]>('/api/admin/players'), enabled: !preview.enabled });
  const liveTables = useQuery({ queryKey: ['admin-live-tables'], queryFn: () => apiGet<LiveTable[]>('/api/admin/tables/live'), enabled: !preview.enabled });
  const stuck = useQuery({ queryKey: ['admin-stuck-holds'], queryFn: () => apiGet<Array<{ id: string; amount: string }>>('/api/admin/tables/stuck-holds'), enabled: !preview.enabled });
  const risk = useQuery({ queryKey: ['admin-risk'], queryFn: () => apiGet<Array<{ id: string; severity: string }>>('/api/admin/risk-queue'), enabled: !preview.enabled });
  const rake = useQuery({
    queryKey: ['admin-rake-rules'],
    queryFn: () => apiGet<{ currentEffective: RakeRule | null; active: RakeRule[]; upcoming: RakeRule[]; historical: RakeRule[]; audit: Array<{ id: string; action: string; createdAt: string }> }>('/api/admin/rake/rules'),
    enabled: !preview.enabled
  });

  const uiPlayers = preview.enabled ? previewPlayers : players.data ?? [];
  const uiTables = preview.enabled ? previewTables : liveTables.data ?? [];
  const uiRake = preview.enabled
    ? { ...previewRake, currentEffective: previewRake.active[0] }
    : rake.data ?? { currentEffective: null, active: [], upcoming: [], historical: [], audit: [] };
  const stuckCount = preview.enabled ? 2 : stuck.data?.length ?? 0;
  const riskCount = preview.enabled ? 4 : risk.data?.length ?? 0;

  return (
    <MobileShell>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Operations console</p>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        </div>
        {preview.enabled ? <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[11px] text-amber-200">Preview mode</span> : null}
      </header>

      <section className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-card"><p className="text-slate-400 text-xs">Live tables</p><p className="mt-1 text-xl font-semibold">{uiTables.length}</p></div>
        <div className="metric-card"><p className="text-slate-400 text-xs">Active players</p><p className="mt-1 text-xl font-semibold">{uiPlayers.filter((p) => p.status === 'ACTIVE').length}</p></div>
        <div className="metric-card"><p className="text-slate-400 text-xs">Risk queue</p><p className="mt-1 text-xl font-semibold text-amber-300">{riskCount}</p></div>
        <div className="metric-card"><p className="text-slate-400 text-xs">Stuck holds</p><p className="mt-1 text-xl font-semibold text-amber-300">{stuckCount}</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="glass-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live tables</h2>
            <span className="text-xs text-slate-400">Transport + seat health</span>
          </div>
          <div className="space-y-2 text-sm">
            {uiTables.map((table) => (
              <div key={table.id} className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{table.name}</p>
                  <p className="text-xs text-slate-400">{table.id.slice(0, 8)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Presence: {table.presences.length} · Held reservations: {table.reservations.length}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-panel p-4">
          <h2 className="text-sm font-semibold">Rake control</h2>
          <p className="mt-1 text-xs text-slate-400">Current effective rule and pipeline</p>
          <div className="mt-3 space-y-2 text-xs">
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-slate-400">Current rule</p>
              <p className="font-semibold">{uiRake.currentEffective ? `v${uiRake.currentEffective.version} · ${(uiRake.currentEffective.rakeBps / 100).toFixed(2)}%` : 'None'}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-slate-400">Upcoming</p>
              <p className="font-semibold">{uiRake.upcoming.length} scheduled rule(s)</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-slate-400">Audit events</p>
              <p className="font-semibold">{uiRake.audit.length} recent changes</p>
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
          <h2 className="text-sm font-semibold">Domain managers</h2>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">Tournament manager</div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">VIP manager</div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">Mission manager</div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">Promo manager</div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 sm:col-span-2">Reward ledger explorer</div>
          </div>
        </article>
      </section>
    </MobileShell>
  );
}
