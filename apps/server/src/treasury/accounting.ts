export type TierBalances = {
  cold: number;
  standby: number;
  hot: number;
};

export function refillHotFromStandby(state: TierBalances, amount: number): TierBalances {
  if (state.standby < amount) throw new Error('insufficient_standby');
  return { ...state, standby: state.standby - amount, hot: state.hot + amount };
}

export function sweepHotToStandby(state: TierBalances, amount: number): TierBalances {
  if (state.hot < amount) throw new Error('insufficient_hot');
  return { ...state, hot: state.hot - amount, standby: state.standby + amount };
}
