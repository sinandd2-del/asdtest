'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { API_BASE, apiGet } from '../../../lib/api';
import { MobileShell } from '../../../components/mobile-shell';
import { usePreviewMode } from '../../../lib/preview';

type Snapshot = {
  version: number;
  phase: string;
  holds: Array<{ reservationId: string; userId: string; amount: number; seatNumber: number }>;
  presences: Array<{ userId: string; connected: boolean; seatNumber?: number }>;
  timer?: { timeoutAt?: number; warningAt?: number; timeoutMs?: number } | null;
  hand?: {
    handId: string;
    phase: string;
    pot: number;
    board: string[];
    actingSeat?: number;
    seats: Array<{ userId: string; seatNumber: number; stack: number; cards: string[]; folded: boolean }>;
    showdown?: { winners: Array<{ userId: string; amount: number; rank: number }> };
  } | null;
};

const previewStates: Record<string, Snapshot> = {
  default: { version: 12, phase: 'WAITING', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }] },
  reconnect: { version: 14, phase: 'PREFLOP', holds: [], presences: [{ userId: 'hero', connected: false, seatNumber: 1 }] },
  buyin: { version: 15, phase: 'WAITING', holds: [{ reservationId: 'r1', userId: 'hero', amount: 50, seatNumber: 1 }], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }] },
  held: { version: 16, phase: 'WAITING', holds: [{ reservationId: 'r2', userId: 'hero', amount: 120, seatNumber: 2 }], presences: [{ userId: 'hero', connected: true, seatNumber: 2 }] },
  occupied: { version: 22, phase: 'FLOP', holds: [{ reservationId: 'r3', userId: 'villain', amount: 100, seatNumber: 4 }], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }, { userId: 'villain', connected: true, seatNumber: 4 }] },
  delta: { version: 18, phase: 'RIVER', holds: [{ reservationId: 'r4', userId: 'hero', amount: 30, seatNumber: 1 }], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }] },
  showdown: { version: 32, phase: 'SHOWDOWN', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }, { userId: 'villain', connected: true, seatNumber: 2 }] },
  'timeout-warning': { version: 34, phase: 'FLOP', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }, { userId: 'villain', connected: true, seatNumber: 2 }], timer: { timeoutMs: 20000, warningAt: Date.now() + 2000, timeoutAt: Date.now() + 4000 } }
};

const seatAnchors = ['left-[10%] top-[65%]', 'left-[28%] top-[78%]', 'left-[50%] top-[82%]', 'left-[72%] top-[78%]', 'left-[88%] top-[65%]', 'left-[88%] top-[28%]', 'left-[72%] top-[12%]', 'left-[50%] top-[8%]', 'left-[28%] top-[12%]'];

async function fetchCsrf() {
  return fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json() as Promise<{ csrfToken: string }>);
}

export default function TablePage() {
  const params = useParams<{ tableId: string }>();
  const preview = usePreviewMode();
  const tableId = params.tableId;
  const [accessToken, setAccessToken] = useState<string>('');
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [snapshot, setSnapshot] = useState<Snapshot>(previewStates.default);
  const [buyInAmount, setBuyInAmount] = useState(20);
  const [walletId, setWalletId] = useState('');
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [deltaMessage, setDeltaMessage] = useState('');
  const [buyInModalOpen, setBuyInModalOpen] = useState(false);
  const [rakeTooltip, setRakeTooltip] = useState<string>('');
  const [activeTables, setActiveTables] = useState<string[]>([]);
  const [selectedSeat, setSelectedSeat] = useState(1);

  useEffect(() => {
    setAccessToken(window.localStorage.getItem('accessToken') ?? '');
    setWalletId(window.localStorage.getItem('walletId') ?? '');
  }, []);

  useEffect(() => {
    const stored = typeof window === 'undefined' ? [] : JSON.parse(window.localStorage.getItem('activeTables') ?? '[]');
    const next = Array.from(new Set([...(stored as string[]), tableId]));
    setActiveTables(next);
    if (typeof window !== 'undefined') window.localStorage.setItem('activeTables', JSON.stringify(next));
  }, [tableId]);

  useEffect(() => {
    if (preview.enabled) {
      setRakeTooltip('Rake 5.00% · Cap 3 · No Flop No Drop');
      return;
    }
    apiGet<{ rake: { percent: number; cap: number; noFlopNoDrop: boolean } | null }>(`/api/tables/${tableId}/rake-info`)
      .then((data) => {
        if (!data.rake) return setRakeTooltip('Rake info unavailable');
        setRakeTooltip(`Rake ${data.rake.percent.toFixed(2)}% · Cap ${data.rake.cap}${data.rake.noFlopNoDrop ? ' · No Flop No Drop' : ''}`);
      })
      .catch(() => setRakeTooltip('Rake info unavailable'));
  }, [preview.enabled, tableId]);

  useEffect(() => {
    if (!preview.enabled) return;
    const current = previewStates[preview.state] ?? previewStates.default;
    setSnapshot(current);
    setSocketState(preview.state === 'reconnect' ? 'disconnected' : 'connected');
    setDeltaMessage(preview.state === 'delta' ? 'HOLD: avail -30 held +30' : '');
    if (current.holds[0]) setReservationId(current.holds[0].reservationId);
  }, [preview.enabled, preview.state]);

  const socket: Socket | null = useMemo(() => {
    if (!accessToken || preview.enabled) return null;
    return io(API_BASE, { transports: ['websocket'], auth: { token: accessToken }, reconnection: true });
  }, [accessToken, preview.enabled]);

  useEffect(() => {
    if (preview.enabled) return;
    if (!socket) {
      setSocketState('disconnected');
      return;
    }

    const join = () => {
      socket.emit('table:join', { tableId, role: 'PLAYER', seatNumber: selectedSeat, reconnectFromVersion: snapshot.version, clientEventId: crypto.randomUUID() }, (ack: { snapshot?: Snapshot }) => {
        if (ack.snapshot) setSnapshot(ack.snapshot);
      });
    };

    socket.on('connect', () => {
      setSocketState('connected');
      join();
    });

    socket.on('disconnect', () => setSocketState('disconnected'));
    socket.on('table:snapshot', (event: Snapshot) => setSnapshot((prev) => ({ ...prev, ...event })));
    socket.on('table:presence', (event: { version: number; presences: Snapshot['presences'] }) => setSnapshot((prev) => ({ ...prev, version: event.version, presences: event.presences })));
    socket.on('table:buyin_state', (event: { version: number; holds: Snapshot['holds'] }) => setSnapshot((prev) => ({ ...prev, version: event.version, holds: event.holds })));
    socket.on('cashier:balance_delta', (event: { reason: string; deltaAvailable: number; deltaHeld: number }) => setDeltaMessage(`${event.reason}: avail ${event.deltaAvailable}, held ${event.deltaHeld}`));

    const heartbeat = window.setInterval(() => {
      socket.emit('table:heartbeat', { tableId, clientEventId: crypto.randomUUID() }, () => undefined);
    }, 15000);

    return () => {
      window.clearInterval(heartbeat);
      socket.emit('table:leave', { tableId, reservationId, clientEventId: crypto.randomUUID() }, () => undefined);
      socket.disconnect();
    };
  }, [socket, tableId, reservationId, snapshot.version, preview.enabled, selectedSeat]);

  const joinSeat = async () => {
    if (preview.enabled) return;
    const csrf = await fetchCsrf();
    await fetch(`${API_BASE}/api/tables/join`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken, authorization: `Bearer ${window.localStorage.getItem('accessToken') ?? ''}` },
      body: JSON.stringify({ tableId, seat: selectedSeat })
    });
  };

  const reserveBuyIn = () => {
    if (preview.enabled) {
      setReservationId('preview-reserve');
      setSnapshot((prev) => ({ ...prev, holds: [{ reservationId: 'preview-reserve', userId: 'hero', amount: buyInAmount, seatNumber: selectedSeat }] }));
      setBuyInModalOpen(false);
      return;
    }

    if (!socket || !walletId) return;
    socket.emit('table:buyin_reserve', { tableId, seatNumber: selectedSeat, amount: buyInAmount, walletId, clientEventId: crypto.randomUUID() }, (ack: { reservation?: { id: string } }) => {
      if (ack.reservation) {
        setReservationId(ack.reservation.id);
        setBuyInModalOpen(false);
      }
    });
  };

  const releaseBuyIn = () => {
    if (!reservationId || !socket) return;
    socket.emit('table:buyin_release', { tableId, reservationId, clientEventId: crypto.randomUUID() }, () => setReservationId(null));
  };

  const sendAction = (action: 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN', amount?: number) => {
    if (!socket || preview.enabled) return;
    socket.emit('table:action', {
      tableId,
      action,
      amount,
      expectedVersion: snapshot.hand?.version ?? snapshot.version,
      actionId: crypto.randomUUID()
    }, () => undefined);
  };

  const reconnectBannerVisible = socketState !== 'connected' || preview.state === 'reconnect';

  return (
    <MobileShell>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Table {tableId.slice(0, 8)}</p>
          <h1 className="text-xl font-semibold">No-Limit Hold'em</h1>
        </div>
      </header>

      {reconnectBannerVisible ? <div className="mb-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-2 text-xs text-amber-200">Connection unstable. Re-syncing table stream…</div> : null}

      <section className="mb-3 rounded-xl border border-slate-700/70 bg-slate-900/70 p-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-300">
          <span>Phase: {snapshot.hand?.phase ?? snapshot.phase}</span>
          <span>•</span>
          <span>Players: {snapshot.presences.filter((p) => p.connected).length}</span>
          <span>•</span>
          <span>Pot: {snapshot.hand?.pot ?? 0}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {activeTables.map((id) => (
            <a key={id} href={`/table/${id}`} className={`rounded px-2 py-1 ${id === tableId ? 'bg-emerald-400 text-black' : 'bg-slate-800 text-slate-200'}`}>{id.slice(0, 6)}</a>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-700/30 bg-gradient-to-b from-emerald-900/40 to-slate-950 p-3 shadow-2xl">
        <div className="relative aspect-[16/10] w-full rounded-[1.6rem] border border-emerald-700/40 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.35),_rgba(6,78,59,0.85)_58%,_rgba(2,6,23,0.95))]">
          {seatAnchors.map((anchor, i) => {
            const seat = snapshot.hand?.seats?.find((p) => p.seatNumber === i + 1) ?? snapshot.presences.find((p) => p.seatNumber === i + 1);
            return (
              <button key={anchor} onClick={() => setSelectedSeat(i + 1)} className={`absolute -translate-x-1/2 -translate-y-1/2 ${anchor}`}>
                <div className={`w-20 rounded-full border px-2 py-1 text-center text-[10px] ${(snapshot.hand?.actingSeat === i + 1) ? 'border-amber-300 bg-amber-300/20 text-amber-100' : seat ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100' : 'border-slate-600 bg-slate-900/80 text-slate-400'} ${selectedSeat === i + 1 ? 'ring-1 ring-white/40' : ''}`}>
                  <p>Seat {i + 1}</p>
                  <p className="truncate">{seat ? ('userId' in seat ? seat.userId : seat.userId) : 'Open'}</p>
                </div>
              </button>
            );
          })}

          <div className="absolute left-1/2 top-1/2 w-52 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-emerald-300/30 bg-slate-900/70 p-3 text-center text-xs">
            <p className="text-slate-300">Board</p>
            <div className="mt-1 flex justify-center gap-1">
              {(snapshot.hand?.board ?? []).map((c) => <span key={c} className="rounded bg-slate-800 px-2 py-1 text-[11px]">{c}</span>)}
              {(snapshot.hand?.board?.length ?? 0) === 0 ? <span className="text-slate-400">No community cards yet</span> : null}
            </div>
            <p className="mt-2 text-slate-300">Main Pot</p>
            <p className="text-lg font-semibold text-emerald-200">{snapshot.hand?.pot ?? 0}</p>
            <p className="mt-1 text-[11px] text-slate-400">{rakeTooltip}</p>
          </div>
        </div>
      </section>

      <section className="mt-3 grid gap-2 sm:grid-cols-3">
        <button className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" onClick={joinSeat}>Sit in seat {selectedSeat}</button>
        <button className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" onClick={() => setBuyInModalOpen(true)}>Buy-in</button>
        <button className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" onClick={releaseBuyIn} disabled={!reservationId}>Release hold</button>
      </section>

      <section className="mt-2 rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-xs">
        <p className="text-slate-400">Reservation</p>
        <p className="mt-1 font-semibold">{reservationId ? `Reserved #${reservationId.slice(0, 6)}` : 'No active reservation'}</p>
        {deltaMessage ? <p className="mt-1 text-emerald-300">Wallet delta: {deltaMessage}</p> : null}
      </section>

      {snapshot.hand?.showdown?.winners?.length ? (
        <section className="mt-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs">
          <p className="font-semibold text-emerald-200">Showdown results</p>
          {snapshot.hand.showdown.winners.map((w) => <p key={`${w.userId}-${w.amount}`}>{w.userId} +{w.amount}</p>)}
        </section>
      ) : null}

      <div className="sticky bottom-0 mt-3 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-2 pb-safe backdrop-blur">
        <div className="grid grid-cols-3 gap-2">
          <button className="rounded-lg bg-slate-800 py-3 text-sm" onClick={() => sendAction('FOLD')}>Fold</button>
          <button className="rounded-lg bg-slate-800 py-3 text-sm" onClick={() => sendAction('CHECK')}>Check</button>
          <button className="rounded-lg bg-emerald-400 py-3 text-sm font-semibold text-black" onClick={() => sendAction('CALL')}>Call</button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button className="rounded-lg bg-slate-800 py-2 text-xs" onClick={() => sendAction('BET', 2)}>Bet 2</button>
          <button className="rounded-lg bg-slate-800 py-2 text-xs" onClick={() => sendAction('RAISE', 4)}>Raise 4</button>
          <button className="rounded-lg bg-slate-800 py-2 text-xs" onClick={() => sendAction('ALL_IN')}>All-in</button>
        </div>
      </div>

      {buyInModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60">
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border border-slate-700 bg-slate-900 p-4 pb-safe">
            <h3 className="text-sm font-semibold">Table buy-in</h3>
            <p className="mt-1 text-xs text-slate-400">Reserve funds before taking a seat.</p>
            <input type="number" value={buyInAmount} min={1} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 p-3" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="rounded-lg bg-slate-800 py-3" onClick={() => setBuyInModalOpen(false)}>Cancel</button>
              <button className="rounded-lg bg-emerald-400 py-3 font-semibold text-black" onClick={reserveBuyIn}>Reserve</button>
            </div>
          </div>
        </div>
      ) : null}
    </MobileShell>
  );
}
