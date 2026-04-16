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
  hand?: { pot: number; phase: string } | null;
};

const previewStates: Record<string, Snapshot> = {
  default: { version: 12, phase: 'WAITING', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }] },
  reconnect: { version: 14, phase: 'PREFLOP', holds: [], presences: [{ userId: 'hero', connected: false, seatNumber: 1 }] },
  buyin: { version: 15, phase: 'WAITING', holds: [{ reservationId: 'r1', userId: 'hero', amount: 50, seatNumber: 1 }], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }] },
  held: { version: 16, phase: 'WAITING', holds: [{ reservationId: 'r2', userId: 'hero', amount: 120, seatNumber: 2 }], presences: [{ userId: 'hero', connected: true, seatNumber: 2 }] },
  spectator: { version: 20, phase: 'TURN', holds: [], presences: [{ userId: 'spectator', connected: true }] },
  occupied: { version: 22, phase: 'FLOP', holds: [{ reservationId: 'r3', userId: 'villain', amount: 100, seatNumber: 4 }], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }, { userId: 'villain', connected: true, seatNumber: 4 }] },
  available: { version: 8, phase: 'WAITING', holds: [], presences: [] },
  delta: { version: 18, phase: 'RIVER', holds: [{ reservationId: 'r4', userId: 'hero', amount: 30, seatNumber: 1 }], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }] },
  'buyin-modal': { version: 10, phase: 'WAITING', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }] },
  'preflop-turn': { version: 30, phase: 'TURN', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }, { userId: 'villain', connected: true, seatNumber: 2 }], hand: { pot: 44, phase: 'turn' }, timer: { timeoutMs: 20000, warningAt: Date.now() + 3000, timeoutAt: Date.now() + 8000 } },
  'all-in': { version: 31, phase: 'RIVER', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }, { userId: 'villain', connected: true, seatNumber: 2 }, { userId: 'third', connected: true, seatNumber: 3 }], hand: { pot: 180, phase: 'river' }, timer: null },
  showdown: { version: 32, phase: 'SHOWDOWN', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }, { userId: 'villain', connected: true, seatNumber: 2 }], hand: { pot: 220, phase: 'showdown' }, timer: null },
  'winner-settled': { version: 33, phase: 'SHOWDOWN', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }], hand: { pot: 0, phase: 'hand_complete' }, timer: null },
  'timeout-warning': { version: 34, phase: 'FLOP', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }, { userId: 'villain', connected: true, seatNumber: 2 }], hand: { pot: 24, phase: 'flop' }, timer: { timeoutMs: 20000, warningAt: Date.now() + 2000, timeoutAt: Date.now() + 4000 } },
};

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
    setBuyInModalOpen(preview.state === 'buyin-modal');
    if (current.holds[0]) setReservationId(current.holds[0].reservationId);
  }, [preview.enabled, preview.state]);

  const socket: Socket | null = useMemo(() => {
    if (!accessToken || preview.enabled) {
      return null;
    }

    return io(API_BASE, {
      transports: ['websocket'],
      auth: { token: accessToken },
      reconnection: true
    });
  }, [accessToken, preview.enabled]);

  useEffect(() => {
    if (preview.enabled) return;
    if (!socket) {
      setSocketState('disconnected');
      return;
    }

    const join = () => {
      socket.emit(
        'table:join',
        { tableId, role: 'PLAYER', reconnectFromVersion: snapshot.version, clientEventId: crypto.randomUUID() },
        (ack: { ok: boolean; snapshot?: Snapshot }) => {
          if (ack.snapshot) setSnapshot(ack.snapshot);
        }
      );
    };

    socket.on('connect', () => {
      setSocketState('connected');
      join();
    });

    socket.on('disconnect', () => setSocketState('disconnected'));
    socket.on('table:snapshot', (event: { version: number; phase: string }) => setSnapshot((prev) => ({ ...prev, version: event.version, phase: event.phase })));
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
  }, [socket, tableId, reservationId, snapshot.version, preview.enabled]);

  const reserveBuyIn = () => {
    if (preview.enabled) {
      setReservationId('preview-reserve');
      setSnapshot((prev) => ({ ...prev, holds: [{ reservationId: 'preview-reserve', userId: 'hero', amount: buyInAmount, seatNumber: 1 }] }));
      setBuyInModalOpen(false);
      return;
    }

    if (!socket || !walletId) return;
    socket.emit('table:buyin_reserve', { tableId, seatNumber: 1, amount: buyInAmount, walletId, clientEventId: crypto.randomUUID() }, (ack: { reservation?: { id: string } }) => {
      if (ack.reservation) {
        setReservationId(ack.reservation.id);
        setBuyInModalOpen(false);
      }
    });
  };

  const releaseBuyIn = () => {
    if (!reservationId) return;
    if (preview.enabled) {
      setReservationId(null);
      setSnapshot((prev) => ({ ...prev, holds: [] }));
      return;
    }
    if (!socket) return;
    socket.emit('table:buyin_release', { tableId, reservationId, clientEventId: crypto.randomUUID() }, () => setReservationId(null));
  };

  const reconnectBannerVisible = socketState !== 'connected' || preview.state === 'reconnect';

  return (
    <MobileShell>
      <header className="mb-2 flex items-center justify-between">
        <p className="text-xs text-slate-400">Table shell</p>
        {preview.enabled ? <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">Preview: {preview.state}</span> : null}
      </header>

      {reconnectBannerVisible ? <div className="mb-2 rounded-lg bg-amber-500/20 p-2 text-xs text-amber-200">Reconnecting to table transport...</div> : null}

      <section className="mb-2 rounded-xl bg-slate-900 p-2 text-xs">
        <p className="text-slate-400">Active tables {activeTables.length} · reconnect {socketState === 'connected' ? 'ok' : 'pending'}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {activeTables.map((id) => (
            <a key={id} href={`/table/${id}`} className={`rounded px-2 py-1 ${id === tableId ? 'bg-emerald-500 text-black' : 'bg-slate-800'}`}>
              {id.slice(0, 6)}
            </a>
          ))}
        </div>
      </section>
      <section className="rounded-3xl bg-gradient-to-b from-emerald-950 to-slate-950 p-3 ring-1 ring-emerald-700/30">
        <div className="aspect-[16/10] rounded-2xl border border-emerald-700/40 p-3 sm:aspect-[21/9]">
          <p className="text-xs uppercase text-emerald-300">Table #{tableId.slice(0, 8)} · v{snapshot.version}</p>
          <p className="text-sm">Phase: {snapshot.phase}</p>
          <p className="mt-1 text-xs text-slate-300" title={rakeTooltip}>ⓘ {rakeTooltip}</p>
          <p className="mt-1 text-xs text-slate-300">Connected players: {snapshot.presences.filter((p) => p.connected).length}</p>
          <p className="mt-1 text-xs text-slate-300">Held buy-ins: {snapshot.holds.length}</p>
          <p className="mt-1 text-xs text-slate-300">Pot: {snapshot.hand?.pot ?? 0}</p>
          {snapshot.timer?.warningAt && snapshot.timer.warningAt < Date.now() ? <p className="mt-1 text-xs text-amber-300">Action timer warning</p> : null}
          {deltaMessage ? <p className="mt-2 text-xs text-emerald-300">Wallet delta: {deltaMessage}</p> : null}
        </div>
      </section>

      <section className="mt-3 rounded-xl bg-slate-900 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Buy-in reservation</h2>
          <button className="rounded-lg bg-slate-800 px-3 py-2 text-xs" onClick={() => setBuyInModalOpen(true)}>Open buy-in</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Reserve held funds before seat lock.</p>
        {reservationId ? <button className="mt-2 w-full rounded-lg bg-slate-800 py-3" onClick={releaseBuyIn}>Release Hold</button> : null}
      </section>

      <div className="sticky bottom-0 mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-950/95 p-2 pb-safe">
        <button className="rounded-lg bg-slate-800 py-3 text-sm">Fold</button>
        <button className="rounded-lg bg-slate-800 py-3 text-sm">Check</button>
        <button className="rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-black">Call</button>
      </div>

      <button className="mt-2 w-full rounded-xl border border-slate-700 py-3 text-sm">Leave table</button>

      {buyInModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60">
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-slate-900 p-4 pb-safe">
            <h3 className="text-sm font-semibold">Buy-in amount</h3>
            <p className="mt-1 text-xs text-slate-400">Mobile-friendly bottom sheet preview.</p>
            <input type="number" value={buyInAmount} min={1} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="mt-3 w-full rounded-lg bg-slate-800 p-3" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="rounded-lg bg-slate-800 py-3" onClick={() => setBuyInModalOpen(false)}>Cancel</button>
              <button className="rounded-lg bg-emerald-500 py-3 font-semibold text-black" onClick={reserveBuyIn}>Reserve Hold</button>
            </div>
          </div>
        </div>
      ) : null}
    </MobileShell>
  );
}
