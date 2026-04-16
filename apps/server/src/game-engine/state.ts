export type EngineState = {
  pot: number;
  currentBet: number;
  toActUserId?: string;
};

export function reduceAction(
  state: EngineState,
  input: { actorUserId: string; action: 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE'; amount?: number }
): EngineState {
  if (state.toActUserId && state.toActUserId !== input.actorUserId) {
    throw new Error('Not your turn');
  }

  if ((input.action === 'BET' || input.action === 'RAISE') && (!input.amount || input.amount <= 0)) {
    throw new Error('Invalid amount');
  }

  if (input.action === 'BET' || input.action === 'RAISE') {
    return {
      ...state,
      currentBet: input.amount!,
      pot: state.pot + input.amount!
    };
  }

  return state;
}
