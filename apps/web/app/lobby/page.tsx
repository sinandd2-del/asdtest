'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ServerTableState } from '@poker/contracts';
import { apiGet } from '../../lib/api';
import { MobileShell } from '../../components/mobile-shell';
import { lobbyFixtures, usePreviewMode } from '../../lib/preview';

type LobbyPayload = {
  tables: ServerTableState[];
  promos?: Array<{ id: string; title: string; body: string }>;
  tournamentLobbyPath?: string;
  bonusCodePlaceholder?: boolean;
};

function seatFill(seated: number, max: number) {
  return `${Math.round((seated / Math.max(max, 1)) * 100)}%`;
}

export default function LobbyPage() {
  const preview = usePreviewMode();
  const { data, isLoading } = useQuery({
    queryKey: ['lobby', 'tables'],
    queryFn: () => apiGet<LobbyPayload>('/api/lobby/tables'),
    refetchInterval: 5000,
    enabled: !preview.enabled
  });

  const tables = preview.enabled ? lobbyFixtures[preview.state] ?? lobbyFixtures.default : data?.tables ?? [];
  const promos = preview.enabled
    ? [{ id: 'p1', title: 'Mission Sprint', body: 'Finish daily missions for instant USDT bonuses.' }]
    : data?.promos ?? [];

  return (
    <MobileShell>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Cash games</p>
          <h1 className="text-2xl font-semibold">Poker Lobby</h1>
        </div>
        {preview.enabled ? <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[11px] text-amber-200">Preview mode</span> : null}
      </header>

      <section className="glass-panel mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Live room overview</p>
            <p className="text-xs text-slate-400">{tables.length} active tables · refreshed every 5s</p>
          </div>
          <div className="flex gap-2 text-xs">
            <Link href={data?.tournamentLobbyPath ?? '/tournaments'} className="rounded-lg bg-emerald-400 px-3 py-2 font-semibold text-black">Tournaments</Link>
            <button className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">Bonus Code</button>
          </div>
        </div>
      </section>

      {promos.length > 0 ? (
        <section className="mb-4 grid gap-2 sm:grid-cols-2">
          {promos.map((promo) => (
            <div key={promo.id} className="rounded-xl border border-indigo-400/20 bg-gradient-to-r from-indigo-600/20 to-emerald-500/10 p-4">
              <p className="text-sm font-semibold">{promo.title}</p>
              <p className="mt-1 text-xs text-slate-300">{promo.body}</p>
            </div>
          ))}
        </section>
      ) : null}

      {isLoading && !preview.enabled ? <p className="text-sm text-slate-400">Loading tables...</p> : null}

      {tables.length === 0 ? (
        <p className="glass-panel p-6 text-center text-sm text-slate-400">No active tables currently. Check back in a moment.</p>
      ) : (
        <section className="space-y-3">
          {tables.map((table) => (
            <article key={table.id} className="glass-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{table.name}</h2>
                  <p className="text-xs text-slate-400">{table.stakes} · {table.maxSeats}-max · {(table as { status?: string }).status ?? table.phase}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-right">
                  <p className="text-xs text-slate-400">Pot</p>
                  <p className="text-sm font-semibold">{table.pot}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                <div className="metric-card">
                  <p className="text-slate-400">Seats filled</p>
                  <p className="mt-1 text-sm font-semibold">{table.seatedCount}/{table.maxSeats} ({seatFill(table.seatedCount, table.maxSeats)})</p>
                </div>
                <div className="metric-card">
                  <p className="text-slate-400">Rake</p>
                  <p className="mt-1 text-sm font-semibold">
                    {table.rakeInfo ? `${table.rakeInfo.percent.toFixed(2)}% · cap ${table.rakeInfo.cap}` : 'N/A'}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-slate-400">Policy</p>
                  <p className="mt-1 text-sm font-semibold">
                    {table.rakeInfo?.noFlopNoDrop ? 'No Flop No Drop' : 'Standard'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/table/${table.id}${preview.enabled ? `?preview=1&state=${preview.state}` : ''}`}
                  className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-black"
                >
                  Join Table
                </Link>
                <button className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm">Watch</button>
              </div>
            </article>
          ))}
        </section>
      )}
    </MobileShell>
  );
}
