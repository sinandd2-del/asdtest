'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { API_BASE } from '../../../lib/api';

async function fetchCsrf() {
  return fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json() as Promise<{ csrfToken: string }>);
}

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'idle' | 'success' | 'invalid'>('idle');

  const verify = async () => {
    const csrf = await fetchCsrf();
    const response = await fetch(`${API_BASE}/api/auth/email/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ token })
    });
    setState(response.ok ? 'success' : 'invalid');
  };

  return (
    <main className="mx-auto max-w-md p-4 text-white">
      <h1 className="text-xl font-semibold">Verify email</h1>
      <p className="mt-2 text-sm text-slate-300">Tap below to complete verification.</p>
      <button className="mt-4 w-full rounded-lg bg-emerald-500 py-3 font-semibold text-black" onClick={verify}>Verify</button>
      {state === 'success' ? <p className="mt-3 text-emerald-300">Email verified.</p> : null}
      {state === 'invalid' ? <p className="mt-3 text-amber-300">Invalid or expired verification link.</p> : null}
    </main>
  );
}
