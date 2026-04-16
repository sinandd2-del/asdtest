import type { Card } from './types.js';

const valueMap: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

function fiveCardScore(cards: Card[]): number {
  const values = cards.map((c) => valueMap[c[0]]).sort((a, b) => b - a);
  const suits = cards.map((c) => c[1]);
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = suits.every((s) => s === suits[0]);
  const uniq = [...new Set(values)].sort((a, b) => a - b);
  const straight = uniq.length === 5 && uniq[4] - uniq[0] === 4;

  if (straight && flush) return 8_000_000 + uniq[4];
  if (groups[0][1] === 4) return 7_000_000 + groups[0][0] * 100 + groups[1][0];
  if (groups[0][1] === 3 && groups[1][1] === 2) return 6_000_000 + groups[0][0] * 100 + groups[1][0];
  if (flush) return 5_000_000 + values.reduce((a, v, i) => a + v * 10 ** (4 - i), 0);
  if (straight) return 4_000_000 + uniq[4];
  if (groups[0][1] === 3) return 3_000_000 + groups[0][0] * 10_000 + groups.slice(1).map((g, i) => g[0] * 10 ** (1 - i)).reduce((a, b) => a + b, 0);
  if (groups[0][1] === 2 && groups[1][1] === 2) return 2_000_000 + Math.max(groups[0][0], groups[1][0]) * 100 + Math.min(groups[0][0], groups[1][0]) * 10 + groups[2][0];
  if (groups[0][1] === 2) return 1_000_000 + groups[0][0] * 10_000 + groups.slice(1).map((g, i) => g[0] * 10 ** (2 - i)).reduce((a, b) => a + b, 0);
  return values.reduce((a, v, i) => a + v * 10 ** (4 - i), 0);
}

function combos<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const go = (start: number, path: T[]) => {
    if (path.length === k) {
      out.push([...path]);
      return;
    }
    for (let i = start; i < arr.length; i += 1) {
      path.push(arr[i]);
      go(i + 1, path);
      path.pop();
    }
  };
  go(0, []);
  return out;
}

export function evaluateSeven(cards: Card[]): number {
  return combos(cards, 5).reduce((best, hand) => Math.max(best, fiveCardScore(hand as Card[])), 0);
}
