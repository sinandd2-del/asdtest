# Showdown and Reveal Rules

## Reveal privacy
- Viewer snapshot reveals:
  - own hole cards to owner before showdown
  - all hole cards during showdown/hand_complete/payout_settlement
  - no private cards to spectators before reveal

## Resolution
- Best 7-card hand per contender is evaluated.
- Payout is side-pot aware and split equally among tied winners in each pot.
- Settlement integration posts `POKER_PAYOUT` and `RAKE` ledger entries with idempotency keys.
