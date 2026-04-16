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
  historical: [{ id: 'rk0', version: 3, gameType: 'NLHE', headsUpOnly: false, effectiveFrom: new Date(Date.now() - 86_400_000).toISOString(), rakeBps: 550, maxCap: 3, stakeMin: 0.1, stakeMax: 5, active: false }]
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

  const showLive = preview.enabled ? preview.state === 'live' || preview.state === 'default' : true;
  const showStuck = preview.enabled ? preview.state === 'stuck' : true;
  const showRisk = preview.enabled ? preview.state === 'risk' : true;
  const showTreasury = preview.enabled ? preview.state === 'treasury' : true;

  const uiPlayers = preview.enabled ? previewPlayers : players.data ?? [];
  const uiTables = preview.enabled ? previewTables : liveTables.data ?? [];
  const uiRake = preview.enabled ? { ...previewRake, currentEffective: previewRake.active[0], audit: [] } : rake.data ?? { currentEffective: null, active: [], upcoming: [], historical: [], audit: [] };

  return (
    <MobileShell>
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin Core</h1>
        {preview.enabled ? <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">Preview: {preview.state}</span> : null}
      </header>
      <p className="text-xs text-slate-400">Live table ops · risk · hold recovery · treasury shell</p>

      <section className="mt-3 rounded-xl bg-slate-900 p-3 text-xs">
        <h2 className="text-sm font-semibold">Rake settings dashboard</h2>
        <p>Active rules: {uiRake.active.length} · Upcoming: {uiRake.upcoming.length} · Historical: {uiRake.historical.length}</p>
        <p className="text-slate-400">Includes heads-up visibility + conflict monitoring foundation.</p>
        <p>Currently effective: {uiRake.currentEffective ? `v${uiRake.currentEffective.version}` : 'none'}</p>
      </section>

      <section className="mt-3 grid gap-2 sm:grid-cols-2">
        <article className="rounded-xl bg-slate-900 p-3 text-xs">
          <h3 className="font-semibold">Active rules</h3>
          {uiRake.active.map((rule) => (
            <p key={rule.id}>v{rule.version} · {rule.gameType} · {(rule.rakeBps / 100).toFixed(2)}% cap {rule.maxCap} {rule.headsUpOnly ? '(HU)' : ''}</p>
          ))}
        </article>
        <article className="rounded-xl bg-slate-900 p-3 text-xs">
          <h3 className="font-semibold">Upcoming scheduled rules</h3>
          {uiRake.upcoming.map((rule) => (
            <p key={rule.id}>v{rule.version} · from {new Date(rule.effectiveFrom).toLocaleString()}</p>
          ))}
        </article>
      </section>

      <section className="mt-3 rounded-xl bg-slate-900 p-3 text-xs">
        <h3 className="font-semibold">Per-stake rake preview calculator (foundation)</h3>
        <p>Use `/api/admin/rake/preview` with stake/blind/pot inputs to preview cap + no-flop-no-drop behavior.</p>
      </section>


      <section className="mt-3 rounded-xl bg-slate-900 p-3 text-xs">
        <h3 className="font-semibold">Historical versions + audit view</h3>
        <p>Historical rules: {uiRake.historical.length}</p>
        <p>Recent rake audit events: {uiRake.audit.length}</p>
      </section>

      <section className="mt-3 grid gap-2 sm:grid-cols-2">
        <article className="rounded-xl bg-slate-900 p-3 text-xs">
          <h3 className="font-semibold">Tournament manager</h3>
          <p>Schedule MTT/SNG, start countdown, assign tables, review registrations.</p>
        </article>
        <article className="rounded-xl bg-slate-900 p-3 text-xs">
          <h3 className="font-semibold">VIP manager</h3>
          <p>Adjust VIP levels, rakeback rules, and user VIP states.</p>
        </article>
        <article className="rounded-xl bg-slate-900 p-3 text-xs">
          <h3 className="font-semibold">Mission manager</h3>
          <p>Create daily missions, streak logic, and claim windows.</p>
        </article>
        <article className="rounded-xl bg-slate-900 p-3 text-xs">
          <h3 className="font-semibold">Promo manager</h3>
          <p>Control banners, bonus code placeholders, and ticket campaigns.</p>
        </article>
      </section>

      <section className="mt-3 rounded-xl bg-slate-900 p-3 text-xs">
        <h3 className="font-semibold">Reward ledger explorer + leaderboard (placeholder)</h3>
        <p>Track TOURNAMENT/VIP/MISSION/BONUS entries with leaderboard scaffold.</p>
      </section>
      {showLive ? (
        <section className="mt-3 rounded-xl bg-slate-900 p-3">
          <h2 className="text-sm font-semibold">Live tables</h2>
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            {uiTables.map((table) => (
              <div key={table.id} className="rounded-lg border border-slate-700 p-2">
                <p>{table.name}</p>
                <p>Seated/present: {table.presences.length}</p>
                <p>Held funds: {table.reservations.length}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showStuck ? (
        <section className="mt-3 rounded-xl bg-amber-500/10 p-3">
          <h2 className="text-sm font-semibold text-amber-300">Stuck holds</h2>
          <p className="text-xs text-amber-200">{preview.enabled ? 2 : stuck.data?.length ?? 0} pending recovery items</p>
        </section>
      ) : null}

      {showRisk ? (
        <section className="mt-3 rounded-xl bg-slate-900 p-3">
          <h2 className="text-sm font-semibold">Risk queue</h2>
          <p className="text-xs text-slate-400">{preview.enabled ? 4 : risk.data?.length ?? 0} unresolved alerts</p>
        </section>
      ) : null}

      {showTreasury ? (
        <section className="mt-3 rounded-xl bg-slate-900 p-3 text-xs">
          <h2 className="text-sm font-semibold">Treasury overview</h2>
          <p>Cold: 1,000,000 USDT</p>
          <p>Standby: 100,000 USDT</p>
          <p>Hot payout: 10,000 USDT</p>
        </section>
      ) : null}

      <section className="mt-3 grid gap-2 sm:grid-cols-2">
        {uiPlayers.map((player) => (
          <article key={player.id} className="rounded-xl bg-slate-900 p-3 text-sm">
            <p className="font-medium">{player.username}</p>
            <p className="text-xs text-slate-400">{player.role} · {player.status}</p>
          </article>
        ))}
      </section>
    </MobileShell>
  );
}
