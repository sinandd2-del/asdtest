import type { SeatState, SidePot } from './types.js';

export function buildSidePots(seats: SeatState[]): SidePot[] {
  const active = seats.filter((s) => s.committed > 0);
  if (active.length === 0) return [];
  const levels = [...new Set(active.map((s) => s.committed))].sort((a, b) => a - b);
  let prev = 0;
  const pots: SidePot[] = [];

  for (const level of levels) {
    const contributors = active.filter((s) => s.committed >= level);
    const amount = (level - prev) * contributors.length;
    if (amount > 0) {
      pots.push({
        amount,
        contenders: contributors.filter((s) => !s.folded).map((s) => s.userId)
      });
    }
    prev = level;
  }

  return pots;
}
