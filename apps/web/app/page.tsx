import Link from 'next/link';
import { MobileShell } from '../components/mobile-shell';

const featuredRooms = [
  { id: 'r1', name: 'NL50 Main', stakes: '0.25 / 0.50', players: 94, fill: 'Hot table' },
  { id: 'r2', name: 'NL200 Prime', stakes: '1 / 2', players: 66, fill: 'Mid stakes' },
  { id: 'r3', name: 'HU Arena', stakes: '1 / 2', players: 28, fill: 'Heads-up' }
];

export default function HomePage() {
  return (
    <MobileShell>
      <section className="glass-panel overflow-hidden p-6 sm:p-8">
        <div className="absolute" />
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="hero-chip">Crypto poker platform</span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              Play cash games that feel like a real poker room.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
              Server-authoritative Hold’em, instant seat entry, transparent wallet balances, and polished mobile gameplay built for grinders and casual players.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/lobby" className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-black shadow-xl shadow-emerald-500/30">
                Play Now
              </Link>
              <Link href="/tournaments" className="rounded-xl border border-slate-600 bg-slate-900/70 px-6 py-3 text-sm font-medium hover:bg-slate-800">
                Tournament Lobby
              </Link>
            </div>

            <div className="mt-6 grid max-w-2xl gap-2 text-xs text-slate-300 sm:grid-cols-3">
              <div className="metric-card"><p className="text-slate-400">24h volume</p><p className="mt-1 text-lg font-semibold text-white">1.82M USDT</p></div>
              <div className="metric-card"><p className="text-slate-400">Players online</p><p className="mt-1 text-lg font-semibold text-white">3,241</p></div>
              <div className="metric-card"><p className="text-slate-400">Cash tables</p><p className="mt-1 text-lg font-semibold text-white">218</p></div>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Featured tables</p>
              <Link className="text-xs text-emerald-300" href="/lobby">View all</Link>
            </div>
            <div className="mt-3 space-y-2">
              {featuredRooms.map((room) => (
                <div key={room.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{room.name}</p>
                    <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-200">{room.fill}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{room.stakes} · {room.players} seated</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-3">
              <p className="text-xs text-slate-400">Fast links</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <Link href="/cashier" className="rounded bg-slate-800 px-2 py-2 text-center">Cashier</Link>
                <Link href="/account" className="rounded bg-slate-800 px-2 py-2 text-center">Account</Link>
                <Link href="/admin" className="rounded bg-slate-800 px-2 py-2 text-center">Admin</Link>
                <Link href="/table/11111111-1111-1111-1111-111111111111" className="rounded bg-slate-800 px-2 py-2 text-center">Quick Table</Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <article className="glass-panel p-4">
          <h2 className="text-sm font-semibold">Fair gameplay runtime</h2>
          <p className="mt-1 text-xs text-slate-400">Server-side deck, validated turns, and deterministic showdown settlement.</p>
        </article>
        <article className="glass-panel p-4">
          <h2 className="text-sm font-semibold">Crypto-native cashier</h2>
          <p className="mt-1 text-xs text-slate-400">Available/held/pending balances and real-time wallet delta updates.</p>
        </article>
        <article className="glass-panel p-4">
          <h2 className="text-sm font-semibold">Operator controls</h2>
          <p className="mt-1 text-xs text-slate-400">Live table controls, stuck-hold recovery, and risk/rake visibility.</p>
        </article>
      </section>
    </MobileShell>
  );
}
