# UI Preview Routes

Preview mode is enabled only in development with `?preview=1`.

## Lobby
- `/lobby?preview=1` (default)
- `/lobby?preview=1&state=crowded`
- `/lobby?preview=1&state=nearly_full`
- `/lobby?preview=1&state=empty`

## Account
- `/account?preview=1&state=logged-out`
- `/account?preview=1&state=logged-in`
- `/account?preview=1&state=sessions`

## Cashier
- `/cashier?preview=1` (normal wallet overview)
- `/cashier?preview=1&state=pending`
- `/cashier?preview=1&state=confirmed`
- `/cashier?preview=1&state=pending_withdrawal`
- `/cashier?preview=1&state=held`
- `/cashier?preview=1&state=delta`
- `/cashier?preview=1&state=address`

## Admin
- `/admin?preview=1` (normal dashboard)
- `/admin?preview=1&state=live`
- `/admin?preview=1&state=stuck`
- `/admin?preview=1&state=risk`
- `/admin?preview=1&state=treasury`

## Table shell
Use demo UUID-like IDs for deterministic screenshots.

- `/table/11111111-1111-1111-1111-111111111111?preview=1` (default)
- `/table/11111111-1111-1111-1111-111111111111?preview=1&state=reconnect`
- `/table/11111111-1111-1111-1111-111111111111?preview=1&state=buyin`
- `/table/11111111-1111-1111-1111-111111111111?preview=1&state=held`
- `/table/11111111-1111-1111-1111-111111111111?preview=1&state=delta`
- `/table/11111111-1111-1111-1111-111111111111?preview=1&state=spectator`
- `/table/11111111-1111-1111-1111-111111111111?preview=1&state=occupied`
- `/table/11111111-1111-1111-1111-111111111111?preview=1&state=available`
- `/table/11111111-1111-1111-1111-111111111111?preview=1&state=buyin-modal`
