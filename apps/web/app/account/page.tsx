'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { MobileShell } from '../../components/mobile-shell';
import { API_BASE, apiGet } from '../../lib/api';
import { usePreviewMode } from '../../lib/preview';

type Session = { id: string; ipAddress: string; userAgent: string; createdAt: string };
type Me = { id: string; username: string; email?: string | null; emailVerifiedAt?: string | null };
type VipState = { state?: { currentLevel: number; points: string; rakebackBalance: string } | null };
type MissionPayload = { progress: Array<{ id: string; progress: number; status: string; missionTemplate: { title: string; goal: number } }> };

async function fetchCsrf() {
  return fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json() as Promise<{ csrfToken: string }>);
}

const sessionFixture: Session[] = [
  { id: 's1', ipAddress: '10.0.0.2', userAgent: 'iPhone Safari', createdAt: '2026-04-16T10:30:00Z' },
  { id: 's2', ipAddress: '10.0.0.3', userAgent: 'Chrome Android', createdAt: '2026-04-16T09:20:00Z' }
];

export default function AccountPage() {
  const preview = usePreviewMode();
  const [username, setUsername] = useState('player1');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('StrongPass123!@#');
  const [message, setMessage] = useState('');

  const sessionsQuery = useQuery({ queryKey: ['account-sessions'], queryFn: () => apiGet<Session[]>('/api/users/sessions'), enabled: !preview.enabled });
  const meQuery = useQuery({ queryKey: ['account-me'], queryFn: () => apiGet<Me>('/api/users/me'), enabled: !preview.enabled });
  const vipQuery = useQuery({ queryKey: ['vip-me'], queryFn: () => apiGet<VipState>('/api/vip/me'), enabled: !preview.enabled });
  const missionQuery = useQuery({ queryKey: ['missions-daily'], queryFn: () => apiGet<MissionPayload>('/api/missions/daily'), enabled: !preview.enabled });

  const state = preview.enabled ? preview.state : 'logged-out';
  const sessions = preview.enabled ? (state === 'sessions' ? sessionFixture : []) : sessionsQuery.data ?? [];

  const register = async () => {
    if (preview.enabled) return setMessage('Preview mode: registration disabled');
    const csrf = await fetchCsrf();
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ username, password, email: email || undefined })
    });
    setMessage(response.ok ? 'Registered successfully' : 'Registration failed');
  };

  const login = async () => {
    if (preview.enabled) return setMessage('Preview mode: login disabled');
    const csrf = await fetchCsrf();
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ usernameOrEmail: username, password })
    });
    const data = await response.json();
    if (response.ok) {
      window.localStorage.setItem('accessToken', data.accessToken);
      setMessage('Logged in');
      void meQuery.refetch();
    } else {
      setMessage('Login failed');
    }
  };

  const claimRakeback = async () => {
    const csrf = await fetchCsrf();
    const response = await fetch(`${API_BASE}/api/vip/claim-rakeback`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken, authorization: `Bearer ${window.localStorage.getItem('accessToken') ?? ''}` }
    });
    setMessage(response.ok ? 'Rakeback claimed' : 'Unable to claim rakeback');
  };

  return (
    <MobileShell>
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Player profile</p>
        <h1 className="text-2xl font-semibold">Account & Security</h1>
      </header>

      <section className="glass-panel p-4">
        <h2 className="text-sm font-semibold">Authentication</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input className="rounded-lg border border-slate-700 bg-slate-900 p-3" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          <input className="rounded-lg border border-slate-700 bg-slate-900 p-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email (optional)" />
          <input className="rounded-lg border border-slate-700 bg-slate-900 p-3" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" />
        </div>
        <div className="mt-3 flex gap-2">
          <button className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2" onClick={register}>Register</button>
          <button className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-black" onClick={login}>Login</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">{message}</p>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="glass-panel p-4">
          <h3 className="text-sm font-semibold">Profile</h3>
          <p className="mt-2 text-xs text-slate-400">User: {meQuery.data?.username ?? 'guest'}</p>
          <p className="text-xs text-slate-400">Email: {meQuery.data?.email ?? 'not set'}</p>
        </article>

        <article className="glass-panel p-4">
          <h3 className="text-sm font-semibold">VIP & rewards</h3>
          <p className="mt-2 text-xs text-slate-400">Level {vipQuery.data?.state?.currentLevel ?? 0} · Points {vipQuery.data?.state?.points ?? '0'}</p>
          <p className="text-xs text-slate-400">Rakeback {vipQuery.data?.state?.rakebackBalance ?? '0'}</p>
          <button className="mt-2 rounded bg-slate-800 px-3 py-2 text-xs" onClick={claimRakeback}>Claim rakeback</button>
        </article>

        <article className="glass-panel p-4">
          <h3 className="text-sm font-semibold">Missions</h3>
          <div className="mt-2 space-y-1 text-xs">
            {(missionQuery.data?.progress ?? []).slice(0, 3).map((m) => <p key={m.id}>{m.missionTemplate.title}: {m.progress}/{m.missionTemplate.goal}</p>)}
            {(missionQuery.data?.progress ?? []).length === 0 ? <p className="text-slate-400">No active mission progress</p> : null}
          </div>
        </article>
      </section>

      <section className="glass-panel mt-4 p-4">
        <h3 className="text-sm font-semibold">Security sessions</h3>
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          {sessions.length === 0 ? <p className="text-slate-400">No active sessions shown.</p> : null}
          {sessions.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-700 bg-slate-950/70 p-2">
              <p>{s.userAgent}</p>
              <p className="text-slate-400">{s.ipAddress}</p>
            </div>
          ))}
        </div>
      </section>
    </MobileShell>
  );
}
