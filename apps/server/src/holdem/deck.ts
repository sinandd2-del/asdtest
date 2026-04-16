import { createHash, randomBytes } from 'node:crypto';
import type { Card } from './types.js';

const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
const suits = ['c', 'd', 'h', 's'] as const;

export function createDeck(): Card[] {
  return suits.flatMap((s) => ranks.map((r) => `${r}${s}` as Card));
}

function randomInt(max: number): number {
  const n = randomBytes(4).readUInt32BE(0);
  return n % max;
}

export function shuffleDeck(input: Card[], seed?: string): { cards: Card[]; ref: string } {
  const cards = [...input];
  let seeded = seed;
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = seeded ? Number.parseInt(createHash('sha256').update(`${seeded}:${i}`).digest('hex').slice(0, 8), 16) % (i + 1) : randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
    if (seeded) seeded = createHash('sha256').update(seeded).digest('hex');
  }
  const ref = createHash('sha256').update(cards.join('')).digest('hex').slice(0, 16);
  return { cards, ref };
}

export function dealCard(deck: Card[]): Card {
  const next = deck.shift();
  if (!next) throw new Error('deck_empty');
  return next;
}
