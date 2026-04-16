# Email Delivery

## Architecture
- Email sending is abstracted behind `sendEmailWithRetry` and provider adapters.
- Initial provider support: `resend`.
- Fallback mode: `noop` provider for local/dev without external delivery.

## Configuration
Required environment variables:
- `EMAIL_PROVIDER` (`noop` or `resend`)
- `RESEND_API_KEY` (required when provider is `resend`)
- `EMAIL_FROM` (verified sender identity/domain)
- `WEB_BASE_URL` (used to build secure verification/reset links)

## Security properties
- Password reset tokens and email verification tokens are stored hashed.
- Tokens are one-time use via `consumedAt`.
- Expiry enforced in verification/reset confirm endpoints.
- API never returns raw password reset token.

## Delivery auditing
- Successful and failed send attempts are written to audit logs (`email.delivery.sent` / `email.delivery.failed`).
- Auth flow actions remain auditable via existing audit logging paths.

## Operational notes
- Use production sender domain verification in Resend.
- Monitor bounce/complaint events from provider dashboard.
- Rotate provider API key and restrict scope.
