'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ServerTableState } from '@poker/contracts';
import { apiGet } from '../../lib/api';
import { MobileShell } from '../../components/mobile-shell';
import { lobbyFixtures, usePreviewMode } from '../../lib/preview';

type LobbyPayload = { tables: ServerTableState[]; promos?: Array<{ id: string; title: string; body: string }>; tournamentLobbyPath?: string; bonusCodePlaceholder?: boolean };

export default function LobbyPage() {
  const preview = usePreviewMode();
  const { data, isLoading } = useQuery({
    queryKey: ['lobby', 'tables'],
    queryFn: () => apiGet<LobbyPayload>('/api/lobby/tables'),
    refetchInterval: 5000,
    enabled: !preview.enabled
  });

  const tables = preview.enabled ? lobbyFixtures[preview.state] ?? lobbyFixtures.default : data?.tables ?? [];
  const promos = preview.enabled ? [{ id: 'p1', title: 'Mission Sprint', body: 'Complete daily missions for USDT rewards.' }] : data?.promos ?? [];

  return (
    <MobileShell>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Lobby</h1>
          <span className="text-xs text-slate-400">Compact mobile mode enabled</span>
        </div>
        {preview.enabled ? <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">Preview: {preview.state}</span> : null}
      </header>
      {isLoading && !preview.enabled ? <p>Loading tables…</p> : null}

      <section className="mb-3 grid gap-2">
        {promos.map((promo) => (
          <div key={promo.id} className="rounded-xl bg-gradient-to-r from-indigo-700/30 to-emerald-700/20 p-3 ring-1 ring-indigo-400/20">
            <p className="text-sm font-semibold">{promo.title}</p>
            <p className="text-xs text-slate-300">{promo.body}</p>
          </div>
        ))}
      </section>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Link href="/tournaments" className="rounded-lg bg-slate-900 p-3 text-center text-sm ring-1 ring-slate-800">Tournament Lobby</Link>
        <button className="rounded-lg bg-slate-900 p-3 text-sm ring-1 ring-slate-800">Bonus Code (Soon)</button>
      </div>

      {tables.length === 0 ? <p className="rounded-xl bg-slate-900 p-4 text-sm text-slate-400">No active tables right now.</p> : null}
      <div className="grid gap-3">
        {tables.map((table) => (
          <article key={table.id} className="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{table.name}</h2>
              <span className="text-xs text-emerald-400">{table.stakes}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Seats {table.seatedCount}/{table.maxSeats} · Phase {table.phase}
            </p>
            {table.rakeInfo ? (
              <p className="mt-1 text-xs text-slate-400">
                Rake {table.rakeInfo.percent.toFixed(2)}% · Cap {table.rakeInfo.cap} {table.rakeInfo.noFlopNoDrop ? '· No Flop No Drop' : ''}
              </p>
            ) : null}
            <Link
              href={`/table/${table.id}${preview.enabled ? `?preview=1&state=${preview.state}` : ''}`}
              className="mt-3 inline-block w-full rounded-lg bg-emerald-500 px-4 py-3 text-center font-medium text-black"
            >
              Open Table
            </Link>
          </article>
        ))}
      </div>
    </MobileShell>
  );
}
