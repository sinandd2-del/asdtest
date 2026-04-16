'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { API_BASE } from '../../../lib/api';

async function fetchCsrf() {
  return fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json() as Promise<{ csrfToken: string }>);
}

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('StrongPass123!@#');
  const [state, setState] = useState<'idle' | 'success' | 'invalid'>('idle');

  const submit = async () => {
    const csrf = await fetchCsrf();
    const response = await fetch(`${API_BASE}/api/auth/password/reset/confirm`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ token, newPassword: password })
    });
    setState(response.ok ? 'success' : 'invalid');
  };

  return (
    <main className="mx-auto max-w-md p-4 text-white">
      <h1 className="text-xl font-semibold">Reset password</h1>
      <p className="mt-2 text-sm text-slate-300">Enter a new password and submit.</p>
      <input className="mt-4 w-full rounded-lg bg-slate-800 p-3" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
      <button className="mt-4 w-full rounded-lg bg-emerald-500 py-3 font-semibold text-black" onClick={submit}>Save new password</button>
      {state === 'success' ? <p className="mt-3 text-emerald-300">Password updated.</p> : null}
      {state === 'invalid' ? <p className="mt-3 text-amber-300">Invalid or expired reset link.</p> : null}
    </main>
  );
}
