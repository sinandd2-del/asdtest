'use client';

import { useSearchParams } from 'next/navigation';

export function usePreviewMode() {
  const searchParams = useSearchParams();
  const isPreviewRequested = searchParams.get('preview') === '1';
  const isEnabled = process.env.NODE_ENV !== 'production' && isPreviewRequested;
  const state = searchParams.get('state') ?? 'default';
  return { enabled: isEnabled, state };
}

export type PreviewTable = {
  id: string;
  name: string;
  stakes: string;
  maxSeats: number;
  seatedCount: number;
  pot: number;
  phase: 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
};

export const lobbyFixtures: Record<string, PreviewTable[]> = {
  default: [
    { id: '11111111-1111-1111-1111-111111111111', name: 'NL25 Fast', stakes: '0.10/0.25', maxSeats: 6, seatedCount: 4, pot: 12, phase: 'PREFLOP' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'NL100 Deep', stakes: '0.50/1.00', maxSeats: 6, seatedCount: 6, pot: 78, phase: 'TURN' }
  ],
  crowded: [
    { id: '33333333-3333-3333-3333-333333333333', name: 'Turbo Ring', stakes: '0.25/0.50', maxSeats: 9, seatedCount: 9, pot: 43, phase: 'FLOP' },
    { id: '44444444-4444-4444-4444-444444444444', name: 'Night Grinder', stakes: '1/2', maxSeats: 6, seatedCount: 5, pot: 190, phase: 'RIVER' },
    { id: '55555555-5555-5555-5555-555555555555', name: 'Beginners', stakes: '0.05/0.10', maxSeats: 6, seatedCount: 3, pot: 4, phase: 'WAITING' }
  ],
  nearly_full: [{ id: '66666666-6666-6666-6666-666666666666', name: 'Prime Time 6-max', stakes: '0.25/0.50', maxSeats: 6, seatedCount: 5, pot: 31, phase: 'PREFLOP' }],
  empty: []
};
