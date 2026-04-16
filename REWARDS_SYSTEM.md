# Rewards System (Missions + Promotions Foundation)

## Scope delivered
This phase adds daily mission and promo campaign foundations, both wired into immutable ledger posting.

## Mission model and APIs
### Data model
- `MissionTemplate`
- `UserMissionProgress`

### Endpoints (`/api/missions`)
- `GET /daily`: player templates + progress view.
- `POST /daily-login`: updates/creates daily login mission progress.
- `POST /:missionTemplateId/claim`: validates completion and credits reward.
- `POST /admin/templates`: admin/support mission creation hook.

### Ledger events
- `MISSION_REWARD` on successful claim.

## Promotion model and APIs
### Data model
- `PromoCampaign`
- `UserRewardWallet`

### Endpoints (`/api/promotions`)
- `GET /banners`: currently active promo banners.
- `POST /bonus-code/redeem`: code redemption placeholder.
- `POST /tickets/grant`: admin/support ticket grant hook.
- `POST /admin/campaigns`: admin/support promo creation hook.

### Ledger events
- `BONUS_REWARD` for bonus code redemption.
- `TOURNAMENT_TICKET` for ticket grants.

## Current limitations / next steps
- Bonus redemption is placeholder economics (`amount = 1`) and needs campaign-specific award rules.
- No per-campaign/user redemption limits or anti-abuse throttles yet.
- No mission expiry sweeper / reconciliation worker yet.
