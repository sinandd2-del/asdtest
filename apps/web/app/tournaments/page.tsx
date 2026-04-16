'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '../../lib/api';
import { usePreviewMode } from '../../lib/preview';

type Tournament = {
  id: string;
  name: string;
  type: 'MTT' | 'SIT_AND_GO';
  status: string;
  buyIn: string;
  fee: string;
  startsAt: string;
  startsInSeconds: number;
  _count?: { registrations: number };
};

async function fetchCsrf() {
  return fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json() as Promise<{ csrfToken: string }>);
}

export default function TournamentsPage() {
  const preview = usePreviewMode();
  const lobby = useQuery({ queryKey: ['tournaments-lobby'], queryFn: () => apiGet<{ scheduled: Tournament[]; sitAndGo: Tournament[] }>('/api/tournaments/lobby'), enabled: !preview.enabled });

  const register = async (tournamentId: string) => {
    const token = window.localStorage.getItem('accessToken');
    const csrf = await fetchCsrf();
    await fetch(`${API_BASE}/api/tournaments/${tournamentId}/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken, authorization: `Bearer ${token ?? ''}` }
    });
  };

  const scheduled = preview.enabled
    ? [{ id: 'pt1', name: 'Preview Nightly', type: 'MTT', status: 'SCHEDULED', buyIn: '10', fee: '1', startsAt: new Date().toISOString(), startsInSeconds: 1800, _count: { registrations: 120 } }]
    : lobby.data?.scheduled ?? [];

  const sitAndGo = preview.enabled
    ? [{ id: 'ps1', name: 'Preview SNG 9-max', type: 'SIT_AND_GO', status: 'REGISTRATION_OPEN', buyIn: '5', fee: '0.5', startsAt: new Date().toISOString(), startsInSeconds: 120, _count: { registrations: 7 } }]
    : lobby.data?.sitAndGo ?? [];

  return (
    <main className="mx-auto max-w-4xl p-4 text-white">
      <h1 className="text-2xl font-semibold">Tournament Lobby</h1>
      <p className="mt-1 text-sm text-slate-400">Scheduled MTT + Sit & Go foundation.</p>

      <section className="mt-4">
        <h2 className="text-lg font-semibold">Scheduled MTTs</h2>
        <div className="mt-2 grid gap-2">
          {scheduled.map((t) => (
            <div key={t.id} className="rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800">
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-slate-400">Buy-in {t.buyIn} + Fee {t.fee} · Players {t._count?.registrations ?? 0}</p>
              <button className="mt-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black" onClick={() => register(t.id)}>Register</button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="text-lg font-semibold">Sit & Go</h2>
        <div className="mt-2 grid gap-2">
          {sitAndGo.map((t) => (
            <div key={t.id} className="rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800">
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-slate-400">Status {t.status} · Starts in {t.startsInSeconds}s</p>
              <button className="mt-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black" onClick={() => register(t.id)}>Join SNG</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
