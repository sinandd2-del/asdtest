import Link from 'next/link';
import { MobileShell } from '../components/mobile-shell';

export default function HomePage() {
  return (
    <MobileShell>
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-xl ring-1 ring-slate-800">
        <p className="text-xs uppercase tracking-wider text-emerald-300">Preview-ready platform shell</p>
        <h1 className="mt-2 text-2xl font-semibold">Poker Platform MVP</h1>
        <p className="mt-2 text-sm text-slate-300">Mobile-first, server-authoritative, extensible architecture.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/lobby" className="rounded-xl bg-emerald-500 px-4 py-3 text-center font-medium text-black">
            Lobby
          </Link>
          <Link href="/cashier" className="rounded-xl border border-slate-700 px-4 py-3 text-center">
            Cashier
          </Link>
          <Link href="/admin" className="rounded-xl border border-slate-700 px-4 py-3 text-center">
            Admin
          </Link>
          <Link href="/account" className="rounded-xl border border-slate-700 px-4 py-3 text-center">
            Account
          </Link>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
        <h2 className="text-sm font-semibold">Quick preview shortcuts</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href="/lobby?preview=1&state=crowded" className="rounded-lg bg-slate-800 px-3 py-2">Crowded lobby</Link>
          <Link href="/cashier?preview=1&state=held" className="rounded-lg bg-slate-800 px-3 py-2">Held balance</Link>
          <Link href="/admin?preview=1&state=live" className="rounded-lg bg-slate-800 px-3 py-2">Live admin</Link>
          <Link href="/table/11111111-1111-1111-1111-111111111111?preview=1&state=buyin-modal" className="rounded-lg bg-slate-800 px-3 py-2">Table buy-in modal</Link>
        </div>
      </section>
    </MobileShell>
  );
}
