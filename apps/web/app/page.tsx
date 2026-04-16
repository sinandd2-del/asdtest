import Link from 'next/link';
import { MobileShell } from '../components/mobile-shell';

const featuredRooms = [
  { id: 'r1', name: 'NL Holdem Deep', stakes: '0.50 / 1.00', players: 84 },
  { id: 'r2', name: 'PLO Pulse', stakes: '0.25 / 0.50', players: 46 },
  { id: 'r3', name: 'Midnight Turbo', stakes: '1 / 2', players: 112 }
];

export default function HomePage() {
  return (
    <MobileShell>
      <section className="glass-panel overflow-hidden p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="hero-chip">Crypto poker room</span>
            <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
              Play real-money poker with a premium mobile-first experience.
            </h1>
            <p className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
              Fast seat entry, clear wallet balances, and a production-style lobby designed for daily grinders and casual players.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/lobby" className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-500/30">
                Enter Lobby
              </Link>
              <Link href="/cashier" className="rounded-xl border border-slate-600 bg-slate-900/70 px-5 py-3 text-sm font-medium hover:bg-slate-800">
                Open Cashier
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-400">
              <span>24h volume: 1.82M USDT</span>
              <span>•</span>
              <span>Active players: 3,241</span>
              <span>•</span>
              <span>Tables live: 218</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold">Featured cash rooms</p>
            <div className="mt-3 space-y-2">
              {featuredRooms.map((room) => (
                <div key={room.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <p className="font-medium">{room.name}</p>
                  <p className="text-xs text-slate-400">{room.stakes} · {room.players} seated</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/lobby" className="glass-panel p-4 transition hover:-translate-y-0.5">
          <p className="text-sm font-semibold">Lobby</p>
          <p className="mt-1 text-xs text-slate-400">Browse ring games and tournaments.</p>
        </Link>
        <Link href="/table/11111111-1111-1111-1111-111111111111" className="glass-panel p-4 transition hover:-translate-y-0.5">
          <p className="text-sm font-semibold">Quick Table</p>
          <p className="mt-1 text-xs text-slate-400">Jump into your most recent seat.</p>
        </Link>
        <Link href="/cashier" className="glass-panel p-4 transition hover:-translate-y-0.5">
          <p className="text-sm font-semibold">Cashier</p>
          <p className="mt-1 text-xs text-slate-400">Deposit, withdraw, and track status.</p>
        </Link>
        <Link href="/admin" className="glass-panel p-4 transition hover:-translate-y-0.5">
          <p className="text-sm font-semibold">Operations</p>
          <p className="mt-1 text-xs text-slate-400">Risk, tables, and treasury controls.</p>
        </Link>
      </section>
    </MobileShell>
  );
}
