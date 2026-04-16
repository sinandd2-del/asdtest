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

  const sessionsQuery = useQuery({
    queryKey: ['account-sessions'],
    queryFn: () => apiGet<Session[]>('/api/users/sessions'),
    enabled: !preview.enabled
  });
  const meQuery = useQuery({ queryKey: ['account-me'], queryFn: () => apiGet<Me>('/api/users/me'), enabled: !preview.enabled });
  const vipQuery = useQuery({ queryKey: ['vip-me'], queryFn: () => apiGet<VipState>('/api/vip/me'), enabled: !preview.enabled });
  const missionQuery = useQuery({ queryKey: ['missions-daily'], queryFn: () => apiGet<MissionPayload>('/api/missions/daily'), enabled: !preview.enabled });

  const state = preview.enabled ? preview.state : 'logged-out';
  const showLoggedInCard = state === 'logged-in' || state === 'sessions';
  const sessions = preview.enabled ? (state === 'sessions' ? sessionFixture : []) : sessionsQuery.data ?? [];

  const register = async () => {
    if (preview.enabled) {
      setMessage('Preview mode: registration disabled');
      return;
    }
    const csrf = await fetchCsrf();
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ username, password, email: email || undefined })
    });
    setMessage(response.ok ? 'Registered (email verification sent if email was provided)' : 'Registration failed');
  };

  const login = async () => {
    if (preview.enabled) {
      setMessage('Preview mode: login disabled');
      return;
    }
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

  const resendVerification = async () => {
    if (preview.enabled) return setMessage('Preview: resend email verification');
    const csrf = await fetchCsrf();
    const response = await fetch(`${API_BASE}/api/auth/email/verify/resend`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf.csrfToken,
        authorization: `Bearer ${window.localStorage.getItem('accessToken') ?? ''}`
      }
    });
    setMessage(response.ok ? 'Verification email sent' : 'Failed to resend verification email');
  };


  const claimRakeback = async () => {
    const csrf = await fetchCsrf();
    const response = await fetch(`${API_BASE}/api/vip/claim-rakeback`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken, authorization: `Bearer ${window.localStorage.getItem('accessToken') ?? ''}` } });
    setMessage(response.ok ? 'Rakeback claimed' : 'Unable to claim rakeback');
  };
  const verified = preview.enabled ? preview.state === 'verified' : Boolean(meQuery.data?.emailVerifiedAt);

  return (
    <MobileShell>
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Account</h1>
        {preview.enabled ? <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">Preview: {preview.state}</span> : null}
      </header>

      <div className="rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="text-sm font-semibold">Access</h2>
        <div className="mt-3 grid gap-2">
          <input className="rounded-lg bg-slate-800 p-3" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          <input className="rounded-lg bg-slate-800 p-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email (optional)" />
          <input className="rounded-lg bg-slate-800 p-3" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" />
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-lg bg-slate-800 py-3" onClick={register}>Register</button>
            <button className="rounded-lg bg-emerald-500 py-3 font-semibold text-black" onClick={login}>Login</button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">{message}</p>
      </div>

      <section className="mt-3 rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="text-sm font-semibold">Security settings</h2>
        <p className="mt-2 text-xs text-slate-400">
          Email status: {meQuery.data?.email ? (verified ? 'Verified ✅' : 'Unverified') : 'No email attached'}
        </p>
        {meQuery.data?.email && !verified ? <button className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs" onClick={resendVerification}>Resend verification email</button> : null}
      </section>


      <section className="mt-3 rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="text-sm font-semibold">VIP</h2>
        <p className="mt-2 text-xs text-slate-400">Level: {vipQuery.data?.state?.currentLevel ?? 0} · Points: {vipQuery.data?.state?.points ?? '0'} · Rakeback: {vipQuery.data?.state?.rakebackBalance ?? '0'}</p>
        <button className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs" onClick={claimRakeback}>Claim rakeback</button>
      </section>

      <section className="mt-3 rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="text-sm font-semibold">Daily missions</h2>
        <div className="mt-2 grid gap-2">
          {(missionQuery.data?.progress ?? []).slice(0, 3).map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-700 p-2 text-xs">
              <p className="font-medium">{m.missionTemplate.title}</p>
              <p className="text-slate-400">{m.progress}/{m.missionTemplate.goal} · {m.status}</p>
            </div>
          ))}
        </div>
      </section>
      {showLoggedInCard ? (
        <section className="mt-3 rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
          <h2 className="text-sm font-semibold">Security sessions</h2>
          <div className="mt-2 grid gap-2 text-xs">
            {sessions.length === 0 ? <p className="text-slate-400">No active sessions shown.</p> : null}
            {sessions.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-700 p-2">
                <p>{s.userAgent}</p>
                <p className="text-slate-400">{s.ipAddress}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </MobileShell>
  );
}
