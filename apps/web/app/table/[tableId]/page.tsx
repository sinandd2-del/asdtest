'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { API_BASE, apiGet } from '../../../lib/api';
import { MobileShell } from '../../../components/mobile-shell';
import { usePreviewMode } from '../../../lib/preview';

type Seat = { userId: string; seatNumber: number; stack: number; cards: string[]; folded: boolean };
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
    dealerSeat?: number;
    currentBet?: number;
    seats: Seat[];
    showdown?: { winners: Array<{ userId: string; amount: number; rank: number }> };
  } | null;
};

const previewStates: Record<string, Snapshot> = {
  default: { version: 12, phase: 'WAITING', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }] },
  reconnect: { version: 14, phase: 'PREFLOP', holds: [], presences: [{ userId: 'hero', connected: false, seatNumber: 1 }] },
  showdown: { version: 22, phase: 'SHOWDOWN', holds: [], presences: [{ userId: 'hero', connected: true, seatNumber: 1 }, { userId: 'villain', connected: true, seatNumber: 3 }] }
};

const seatAnchors = [
  'left-[12%] top-[67%]',
  'left-[28%] top-[82%]',
  'left-[50%] top-[86%]',
  'left-[72%] top-[82%]',
  'left-[88%] top-[67%]',
  'left-[88%] top-[24%]',
  'left-[72%] top-[10%]',
  'left-[50%] top-[6%]',
  'left-[28%] top-[10%]'
] as const;

async function fetchCsrf() {
  return fetch(`${API_BASE}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json() as Promise<{ csrfToken: string }>);
}

function nextSeat(ordered: number[], from?: number) {
  if (!from || ordered.length === 0) return undefined;
  const idx = ordered.indexOf(from);
  if (idx < 0) return undefined;
  return ordered[(idx + 1) % ordered.length];
}

export default function TablePage() {
  const params = useParams<{ tableId: string }>();
  const preview = usePreviewMode();
  const tableId = params.tableId;
  const [accessToken, setAccessToken] = useState('');
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [snapshot, setSnapshot] = useState<Snapshot>(previewStates.default);
  const [buyInAmount, setBuyInAmount] = useState(50);
  const [walletId, setWalletId] = useState('');
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [buyInModalOpen, setBuyInModalOpen] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(1);
  const [lastActionBySeat, setLastActionBySeat] = useState<Record<number, string>>({});
  const [raiseTo, setRaiseTo] = useState(6);

  useEffect(() => {
    setAccessToken(window.localStorage.getItem('accessToken') ?? '');
    setWalletId(window.localStorage.getItem('walletId') ?? '');
  }, []);

  useEffect(() => {
    if (!preview.enabled) return;
    setSnapshot(previewStates[preview.state] ?? previewStates.default);
    setSocketState(preview.state === 'reconnect' ? 'disconnected' : 'connected');
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

    const heartbeat = window.setInterval(() => {
      socket.emit('table:heartbeat', { tableId, clientEventId: crypto.randomUUID() }, () => undefined);
    }, 15000);

    return () => {
      window.clearInterval(heartbeat);
      socket.emit('table:leave', { tableId, reservationId, clientEventId: crypto.randomUUID() }, () => undefined);
      socket.disconnect();
    };
  }, [socket, tableId, reservationId, preview.enabled, selectedSeat, snapshot.version]);

  const orderedSeats = useMemo(() => [...(snapshot.hand?.seats ?? [])].map((s) => s.seatNumber).sort((a, b) => a - b), [snapshot.hand?.seats]);
  const dealerSeat = snapshot.hand?.dealerSeat;
  const sbSeat = nextSeat(orderedSeats, dealerSeat);
  const bbSeat = nextSeat(orderedSeats, sbSeat);
  const heroSeat = snapshot.hand?.seats.find((s) => s.cards.length > 0);
  const heroSeatNumber = heroSeat?.seatNumber;
  const isMyTurn = snapshot.hand?.actingSeat === heroSeatNumber;

  useEffect(() => {
    if (!heroSeat) return;
    setRaiseTo(Math.max(2, Math.min(heroSeat.stack, (snapshot.hand?.currentBet ?? 2) + 2)));
  }, [heroSeat?.stack, snapshot.hand?.currentBet]);

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
    if (!socket || !walletId) return;
    socket.emit('table:buyin_reserve', { tableId, seatNumber: selectedSeat, amount: buyInAmount, walletId, clientEventId: crypto.randomUUID() }, (ack: { reservation?: { id: string } }) => {
      if (ack.reservation) {
        setReservationId(ack.reservation.id);
        setBuyInModalOpen(false);
      }
    });
  };

  const action = (type: 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN', amount?: number) => {
    if (!socket || !snapshot.hand) return;
    socket.emit('table:action', {
      tableId,
      action: type,
      amount,
      expectedVersion: snapshot.hand.version,
      actionId: crypto.randomUUID()
    }, () => undefined);
    if (heroSeatNumber) setLastActionBySeat((prev) => ({ ...prev, [heroSeatNumber]: amount ? `${type} ${amount}` : type }));
  };

  const statusMessage = snapshot.hand?.showdown?.winners?.length
    ? (snapshot.hand.showdown.winners.some((w) => w.userId === heroSeat?.userId) ? 'You won this hand' : 'You lost this hand')
    : isMyTurn
      ? 'Your turn'
      : snapshot.hand
        ? `Waiting for seat ${snapshot.hand.actingSeat}`
        : 'Waiting for players to buy in';

  return (
    <MobileShell>
      <header className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Cash Table</p>
          <h1 className="text-xl font-semibold">No-Limit Hold'em</h1>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] ${socketState === 'connected' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-amber-400/20 text-amber-200'}`}>{socketState}</span>
      </header>

      <p className="mb-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">{statusMessage}</p>

      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-700/30 bg-gradient-to-b from-emerald-900/30 to-slate-950 p-2 sm:p-3 shadow-2xl">
        <div className="relative aspect-[16/10] rounded-[1.5rem] border border-emerald-700/40 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.35),_rgba(6,78,59,0.82)_58%,_rgba(2,6,23,0.95))]">
          {seatAnchors.map((anchor, idx) => {
            const seatNum = idx + 1;
            const seat = snapshot.hand?.seats?.find((s) => s.seatNumber === seatNum);
            const reserved = snapshot.holds.some((h) => h.seatNumber === seatNum);
            const occupied = Boolean(seat) || snapshot.presences.some((p) => p.seatNumber === seatNum);
            const isActing = snapshot.hand?.actingSeat === seatNum;
            const blindTag = seatNum === dealerSeat ? 'D' : seatNum === sbSeat ? 'SB' : seatNum === bbSeat ? 'BB' : null;

            return (
              <button key={seatNum} onClick={() => setSelectedSeat(seatNum)} className={`absolute -translate-x-1/2 -translate-y-1/2 ${anchor}`}>
                <div className={`w-[86px] rounded-xl border px-2 py-1 text-center text-[10px] transition ${isActing ? 'border-amber-300 bg-amber-300/20 shadow-[0_0_18px_rgba(252,211,77,0.45)]' : occupied ? 'border-emerald-400/40 bg-slate-900/90' : 'border-slate-600 bg-slate-900/70'} ${selectedSeat === seatNum ? 'ring-2 ring-white/30' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span>Seat {seatNum}</span>
                    {blindTag ? <span className="rounded bg-slate-700 px-1">{blindTag}</span> : null}
                  </div>
                  <p className="truncate font-medium">{seat?.userId ?? (reserved ? 'Reserved' : occupied ? 'Occupied' : 'Sit here')}</p>
                  {seat ? (
                    <div className="mt-1 flex justify-center gap-1">
                      {(seat.cards.length > 0 ? seat.cards : ['🂠', '🂠']).slice(0, 2).map((card, i) => (
                        <span key={`${seatNum}-${i}-${card}`} className="rounded border border-white/20 bg-slate-800 px-1 text-[9px]">{card}</span>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-[10px] text-slate-400">{seat ? `${seat.stack}` : '--'}</p>
                  {lastActionBySeat[seatNum] ? <p className="text-[10px] text-amber-200">{lastActionBySeat[seatNum]}</p> : null}
                </div>
              </button>
            );
          })}

          <div className="absolute left-1/2 top-1/2 w-56 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-emerald-300/30 bg-slate-900/75 p-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Pot</p>
            <p className="text-2xl font-semibold text-emerald-200">{snapshot.hand?.pot ?? 0}</p>
            <div className="mt-2 flex justify-center gap-1.5">
              {(snapshot.hand?.board ?? []).map((card, i) => (
                <div key={`${card}-${i}`} className="h-10 w-7 rounded-md border border-white/20 bg-white text-center text-[11px] font-semibold text-slate-900 shadow transition duration-500 ease-out">
                  <span className="leading-10">{card}</span>
                </div>
              ))}
              {(snapshot.hand?.board?.length ?? 0) === 0 ? <span className="text-xs text-slate-400">Community cards</span> : null}
            </div>
          </div>

          {heroSeat ? (
            <div className="absolute bottom-[22%] left-1/2 flex -translate-x-1/2 gap-2">
              {heroSeat.cards.map((c) => <div key={c} className="h-11 w-8 rounded-md border border-white/20 bg-white text-center text-xs font-semibold leading-[44px] text-slate-900 shadow-lg">{c}</div>)}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <button className="rounded-lg border border-slate-700 bg-slate-900 py-2" onClick={joinSeat}>Sit seat {selectedSeat}</button>
        <button className="rounded-lg border border-slate-700 bg-slate-900 py-2" onClick={() => setBuyInModalOpen(true)}>Buy-in</button>
        <button className="rounded-lg border border-slate-700 bg-slate-900 py-2" onClick={() => reservationId && socket?.emit('table:buyin_release', { tableId, reservationId, clientEventId: crypto.randomUUID() }, () => setReservationId(null))} disabled={!reservationId}>Release</button>
      </section>

      <div className="sticky bottom-0 mt-3 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-2 pb-safe backdrop-blur">
        <div className="mb-2 px-1 text-xs text-slate-400">Bet / Raise to {raiseTo}</div>
        <input
          className="mb-2 w-full accent-emerald-400"
          type="range"
          min={Math.max(2, snapshot.hand?.currentBet ?? 2)}
          max={Math.max(Math.max(2, snapshot.hand?.currentBet ?? 2), heroSeat?.stack ?? 20)}
          value={raiseTo}
          onChange={(e) => setRaiseTo(Number(e.target.value))}
        />
        <div className="grid grid-cols-5 gap-2">
          <button className="rounded-lg bg-slate-800 py-3 text-sm" onClick={() => action('FOLD')} disabled={!isMyTurn}>Fold</button>
          <button className="rounded-lg bg-slate-800 py-3 text-sm" onClick={() => action('CHECK')} disabled={!isMyTurn}>Check</button>
          <button className="rounded-lg bg-slate-800 py-3 text-sm" onClick={() => action('CALL')} disabled={!isMyTurn}>Call</button>
          <button className="rounded-lg bg-slate-800 py-3 text-sm" onClick={() => action('RAISE', raiseTo)} disabled={!isMyTurn}>Raise</button>
          <button className="rounded-lg bg-emerald-400 py-3 text-sm font-semibold text-black" onClick={() => action('ALL_IN')} disabled={!isMyTurn}>All-in</button>
        </div>
      </div>

      {buyInModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60">
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border border-slate-700 bg-slate-900 p-4 pb-safe">
            <h3 className="text-sm font-semibold">Reserve buy-in</h3>
            <p className="mt-1 text-xs text-slate-400">Seat {selectedSeat} · choose your buy-in amount.</p>
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
